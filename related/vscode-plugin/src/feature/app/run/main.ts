import vscode from 'vscode';

import { Activatible } from '../../../core/activation';
import { ActionStorage } from '../../../core/storage';

import { BaseFeature } from '../../base';
import { TargetEvent } from '../../../core/types';

import { AppChoice, ResolvedAppChoice } from './types';
import { AppRunUtil } from './util';

type Recent = { mode: 'recent', count: number };
type All = { mode: 'all' };

/**
 * App run feature
 */
@Activatible('@travetto/app', 'run')
export class AppRunFeature extends BaseFeature {

  #storage: ActionStorage<AppChoice>;

  getAppList(): Promise<AppChoice[]> {
    this.log.info('Retrieving application list');
    return AppRunUtil.getAppList(this.module);
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
   * Persist config
   */
  async exportLaunchConfig(): Promise<void> {
    try {
      const choice = await AppRunUtil.chooseApp('Export Application Launch', await this.getValidRecent(10));

      if (!choice) {
        return;
      }

      const config = AppRunUtil.getLaunchConfig(choice);

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
   * Select an application and run it
   * @param title
   * @param apps
   */
  async selectAndRunApp(title: string, mode: Recent | All): Promise<void> {
    try {
      const choices = mode.mode === 'all' ?
        await this.getAppList() :
        await this.getValidRecent(mode.count);

      const choice = await AppRunUtil.chooseApp(title, choices);

      if (choice) {
        this.#storage.set(choice.key!, choice);
        return this.debugApp(choice, choice.inputs);
      }
    } catch (err) {
      vscode.window.showErrorMessage(err instanceof Error ? err.message : JSON.stringify(err));
    }
  }

  /**
   * Debug the application with the given choices
   * @param title
   * @param apps
   */
  async debugApp(appOrName?: AppChoice | string | Recent, inputs?: string[], line?: number): Promise<void> {
    let app: AppChoice | undefined;
    if (appOrName) {
      if (typeof appOrName === 'string') {
        const list = await this.getAppList();
        app = list.find(x => x.globalName === appOrName || x.name === appOrName);
      } else if ('name' in appOrName) {
        app = appOrName;
      } else {
        // Get recent
        app = (await this.getValidRecent(1))[0];
      }
    }

    if (app) {
      this.log.info('Running', app.module, app.targetId, inputs);
      const resolved: ResolvedAppChoice = { ...app, inputs: inputs ?? app.inputs ?? [], resolved: true, key: app.key ?? '', time: app.time ?? Date.now() };
      return AppRunUtil.debugApp(resolved, line);
    } else {
      this.log.info('No app selected');
    }
  }

  /**
   * Build code lenses for a given document
   * @param doc
   */
  async buildCodeLenses(doc: vscode.TextDocument): Promise<vscode.CodeLens[] | undefined> {
    const hasApp = ' '.repeat(doc.lineCount).split('').some((x, i) => doc.lineAt(i).text.includes(`${'@'}Application`));

    if (!hasApp) {
      return;
    }
    try {
      return (await this.getAppList())
        .filter(x => x.file === doc.fileName)
        .map(app => ({
          range: doc.lineAt(app.start - 1).range,
          isResolved: true,
          command: {
            command: this.commandName('run'),
            title: 'Debug Application',
            arguments: [app.globalName, app.codeStart]
          }
        }));
    } catch (err) {
      // Ignore
    }
  }

  /**
   * Register command handlers
   */
  activate(context: vscode.ExtensionContext): void {
    this.#storage = new ActionStorage<AppChoice>('app.run', context);

    this.register('new', () => this.selectAndRunApp('Run new application', { mode: 'all' }));
    this.register('run', (name?: string, line?: number) => this.debugApp(name, undefined, line));
    this.register('recent', () => this.selectAndRunApp('Run Recent Application', { mode: 'recent', count: 10 }));
    this.register('mostRecent', () => this.debugApp({ mode: 'recent', count: 1 }));
    this.register('export', () => this.exportLaunchConfig());
  }

  /**
   * On IPC trigger to run an application
   */
  onEvent(ev: TargetEvent<{ name: string, args: string[] }>): Promise<void> {
    return this.debugApp(ev.data.name, ev.data.args);
  }
}