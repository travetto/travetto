import * as vscode from 'vscode';

import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';
import { ActionStorage } from '../../../core/storage';

import { AppChoice } from './types';
import { AppSelectorUtil } from './util';
import { BaseFeature } from '../../base';

/**
 * App run feature
 */
@Activatible('@travetto/app', 'run')
export class AppRunFeature extends BaseFeature {

  private storage = new ActionStorage<AppChoice>('app.run', Workspace.path);

  private runner(title: string, choices: () => Promise<AppChoice[] | AppChoice | undefined>) {
    return async () => {
      const choice = await choices();
      if (choice) {
        await this.runApplication(title, choice);
      }
    };
  }

  /**
   * Get list of applications
   */
  async getAppList() {
    return JSON.parse(await this.runPlugin('list')) as AppChoice[];
  }

  /**
   * Find list of recent choices, that are valid
   * @param count
   */
  async getValidRecent(count: number): Promise<AppChoice[]> {
    const appList = await this.getAppList();

    return this.storage.getRecentAndFilterState(count * 2, x =>
      appList.some(a => a.id === x.id && a.name === x.name)
    )
      .map(x => x.data)
      .slice(0, count);
  }

  /**
   * Handle application choices
   * @param title
   * @param choices
   */
  async resolveChoices(title: string, choices: AppChoice[] | AppChoice) {
    const choice = await AppSelectorUtil.resolveChoices(title, choices);
    if (choice) {
      const key = `${choice.id}#${choice.name}:${choice.inputs.join(',')}`;
      this.storage.set(key, { ...choice, time: Date.now(), key });
      return choice;
    }
  }

  /**
   * Get full launch config
   * @param choice
   */
  getLaunchConfig(choice: AppChoice) {
    const args = choice.inputs.map(x => `${x}`.replace(Workspace.path, '.')).join(', ');
    const env = Workspace.getDefaultEnv({});

    return Workspace.generateLaunchConfig({
      name: `[Travetto] ${choice.name}${args ? `: ${args}` : ''}`,
      program: this.resolvePlugin('run'),
      args: [choice.name, ...choice.inputs].map(x => `${x}`),
      env,
      cwd: Workspace.path
    });
  }

  /**
   * Persist config
   */
  async exportLaunchConfig() {
    try {
      const choice = await this.resolveChoices('Export Application Launch', await this.getValidRecent(10));

      if (!choice) {
        return;
      }

      const config = this.getLaunchConfig(choice);

      const launchConfig = vscode.workspace.getConfiguration('launch');
      const configurations = launchConfig['configurations'];
      configurations.push(config);
      await launchConfig.update('configurations', configurations, false);

      vscode.window.showInformationMessage('Added new configuration to launch.json!');
    } catch (e) {
      vscode.window.showErrorMessage(e.message);
    }
  }

  /**
   * Run the application with the given choices
   * @param title
   * @param apps
   */
  async runApplication(title: string, apps: AppChoice[] | AppChoice) {
    try {
      const choice = await this.resolveChoices(title, apps);

      if (!choice) {
        return;
      }

      await vscode.debug.startDebugging(Workspace.folder, this.getLaunchConfig(choice));
    } catch (e) {
      vscode.window.showErrorMessage(e.message);
    }
  }

  /**
   * Build code lenses for a given document
   * @param doc
   */
  async buildCodeLenses(doc: vscode.TextDocument) {
    return (await this.getAppList())
      .filter(x => x.filename === doc.fileName)
      .map(app => ({
        range: doc.lineAt(app.start - 1).range,
        isResolved: true,
        command: {
          command: this.commandName('new'),
          title: `Debug Application`,
          arguments: [app.name, app.codeStart]
        }
      }));
  }

  /**
   * Register command handlers
   */
  activate() {
    this.register('new', (name?: string, line?: number) =>
      this.runner('Run New Application', async () => {
        const list = await this.getAppList();
        if (name) {
          const choice = list.find(x => x.name === name);
          if (choice && line) {
            const active = Workspace.getDocumentEditor(vscode.window.activeTextEditor);
            if (active) {
              Workspace.addBreakpoint(active, line);
            }
          }
          return choice;
        } else {
          return list;
        }
      })()
    );
    this.register('recent', this.runner('Run Recent Application', () => this.getValidRecent(10)));
    this.register('mostRecent', this.runner('Run Most Recent Application', () => this.getValidRecent(1).then(([x]) => x)));
    this.register('export', async () => this.exportLaunchConfig());

    vscode.languages.registerCodeLensProvider({
      language: 'typescript',
      pattern: {
        base: Workspace.path,
        pattern: '**/src/**'
      }
    }, { provideCodeLenses: this.buildCodeLenses.bind(this) });
  }
}