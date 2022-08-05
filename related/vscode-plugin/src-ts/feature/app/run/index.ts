import * as vscode from 'vscode';

import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';
import { ActionStorage } from '../../../core/storage';

import { AppChoice } from './types';
import { AppSelectorUtil } from './util';
import { BaseFeature } from '../../base';
import { TargetEvent } from '../../../core/types';

/**
 * App run feature
 */
@Activatible('app', 'run')
export class AppRunFeature extends BaseFeature {

  #storage = new ActionStorage<AppChoice>('app.run', Workspace.path);

  #runner(title: string, choices: () => Promise<AppChoice[] | AppChoice | undefined>, line?: number) {
    return async (): Promise<void> => {
      const choice = await choices();
      if (choice) {
        await this.runApplication(title, choice, line);
      }
    };
  }

  /**
   * Get list of applications
   */
  async getAppList(): Promise<AppChoice[]> {
    await Workspace.buildCode();
    const choices = await Workspace.runMain<AppChoice[]>(Workspace.binPath(this.module, 'list-get'), [], { format: 'json' });
    return choices.map(x => {
      x.inputs ??= [];
      return x;
    });
  }

  /**
   * Find list of recent choices, that are valid
   * @param count
   */
  async getValidRecent(count: number): Promise<AppChoice[]> {
    const appList = await this.getAppList();

    return this.#storage.getRecentAndFilterState(count * 2, x =>
      !appList.some(a => a.targetId === x.targetId && a.name === x.name)
    )
      .map(x => x.data)
      .slice(0, count);
  }

  /**
   * Handle application choices
   * @param title
   * @param choices
   */
  async resolveChoices(title: string, choices: AppChoice[] | AppChoice): Promise<AppChoice | undefined> {
    const choice = await AppSelectorUtil.resolveChoices(title, choices);
    if (choice) {
      const key = `${choice.targetId}#${choice.name}:${choice.inputs.join(',')}`;
      this.#storage.set(key, { ...choice, time: Date.now(), key });
      return choice;
    }
  }

  /**
   * Get full launch config
   * @param choice
   */
  getLaunchConfig(choice: AppChoice): ReturnType<(typeof Workspace)['generateLaunchConfig']> {
    const args = choice.inputs.map(x => `${x}`.replace(Workspace.path, '.')).join(', ');

    const config = Workspace.generateLaunchConfig(
      `[Travetto] ${choice.name}${args ? `: ${args}` : ''}`,
      Workspace.binPath(this.module, 'run'),
      [choice.name, ...choice.inputs],
      { TRV_DYNAMIC: '1' }
    );

    return config;
  }

  /**
   * Persist config
   */
  async exportLaunchConfig(): Promise<void> {
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
    } catch (err) {
      vscode.window.showErrorMessage(err instanceof Error ? err.message : JSON.stringify(err));
    }
  }

  /**
   * Run the application with the given choices
   * @param title
   * @param apps
   */
  async runApplication(title: string, apps: AppChoice[] | AppChoice, line?: number): Promise<void> {
    try {
      const choice = await this.resolveChoices(title, apps);

      if (!choice) {
        return;
      }

      if (line) {
        const editor = vscode.window.visibleTextEditors.find(x => x.document.fileName === choice.filename);
        if (editor) {
          Workspace.addBreakpoint(editor, line);
          await Workspace.sleep(100);
        }
      }

      await vscode.debug.startDebugging(Workspace.folder, this.getLaunchConfig(choice));
    } catch (err) {
      vscode.window.showErrorMessage(err instanceof Error ? err.message : JSON.stringify(err));
    }
  }

  /**
   * Build code lenses for a given document
   * @param doc
   */
  async buildCodeLenses(doc: vscode.TextDocument): Promise<vscode.CodeLens[] | undefined> {
    const hasApp = ' '.repeat(doc.lineCount).split('').some((x, i) => /@Application/.test(doc.lineAt(i).text));

    if (!hasApp) {
      return;
    }

    return (await this.getAppList())
      .filter(x => x.filename === doc.fileName)
      .map(app => ({
        range: doc.lineAt(app.start - 1).range,
        isResolved: true,
        command: {
          command: this.commandName('new'),
          title: 'Debug Application',
          arguments: [app.name, app.codeStart]
        }
      }));
  }

  /**
   * Register command handlers
   */
  activate(): void {
    this.register('new', (name?: string, line?: number) =>
      this.#runner('Run New Application', async () => {
        const list = await this.getAppList();
        return name ? list.find(x => x.name === name) : list;
      }, line)()
    );
    this.register('recent', this.#runner('Run Recent Application', () => this.getValidRecent(10)));
    this.register('mostRecent', this.#runner('Run Most Recent Application', () => this.getValidRecent(1).then(([x]) => x)));
    this.register('export', async () => this.exportLaunchConfig());
  }

  async onEvent(ev: TargetEvent<{ name: string, args: string[] }>): Promise<void> {
    const { name, args } = ev.data;
    const app = (await this.getAppList()).find(a => a.name === name);

    if (app) {
      await this.runApplication(name, { ...app, inputs: args });
    }
  }
}