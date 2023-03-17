import vscode from 'vscode';

import { Activatible } from '../../../core/activation';
import { ActionStorage } from '../../../core/storage';

import { BaseFeature } from '../../base';
import { TargetEvent } from '../../../core/types';
import { Workspace } from '../../../core/workspace';

import { RunChoice } from './types';
import { CliRunUtil } from './util';

type Recent = { mode: 'recent', count: number };
type All = { mode: 'all' };

@Activatible('@travetto/cli', 'run')
export class CliRunFeature extends BaseFeature {

  #storage: ActionStorage<RunChoice>;

  /**
   * Find list of recent choices, that are valid
   * @param count
   */
  async getValidRecent(count: number): Promise<RunChoice[]> {
    const choices = await CliRunUtil.getChoices();

    return this.#storage.getRecentAndFilterState(count * 2, x =>
      !choices.some(a => a.name === x.name)
    )
      .map(x => x.data)
      .slice(0, count);
  }

  /**
   * Persist config
   */
  async exportLaunchConfig(): Promise<void> {
    try {
      const choice = await CliRunUtil.makeChoice('Export Application Launch', await this.getValidRecent(10));

      if (!choice) {
        return;
      }

      const config = CliRunUtil.getLaunchConfig(choice);

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
   * Select a target and run it
   */
  async chooseAndRun(title: string, mode: Recent | All): Promise<void> {
    try {
      const choices = mode.mode === 'all' ?
        await CliRunUtil.getChoices() :
        await this.getValidRecent(mode.count);

      const choice = await CliRunUtil.makeChoice(title, choices);

      if (choice) {
        this.#storage.set(choice.key!, choice);
        return this.debugTarget(choice, choice.inputs);
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
  async debugTarget(appOrName?: RunChoice | string | Recent, inputs?: string[]): Promise<void> {
    let choice: RunChoice | undefined;
    if (appOrName) {
      if (typeof appOrName === 'string') {
        const list = await CliRunUtil.getChoices();
        choice = list.find(x => x.name === appOrName);
      } else if ('name' in appOrName) {
        choice = appOrName;
      } else {
        // Get recent
        choice = (await this.getValidRecent(1))[0];
      }
    }

    if (choice) {
      this.log.info('Running', choice.name, inputs);
      try {
        await vscode.debug.startDebugging(Workspace.folder, CliRunUtil.getLaunchConfig({
          ...choice,
          inputs: inputs ?? choice.inputs ?? [],
          resolved: true,
          key: choice.key ?? '',
          time: choice.time ?? Date.now()
        }));
      } catch (err) {
        vscode.window.showErrorMessage(err instanceof Error ? err.message : JSON.stringify(err));
      }
    } else {
      this.log.info('No app selected');
    }
  }

  /**
   * Register command handlers
   */
  activate(context: vscode.ExtensionContext): void {
    console.log('REgistering again?', new Date());
    this.#storage = new ActionStorage<RunChoice>('cli.run', context);

    this.register('new', () => this.chooseAndRun('Run New Command', { mode: 'all' }));
    this.register('run', (name?: string) => this.debugTarget(name));
    this.register('recent', () => this.chooseAndRun('Run Recent Command', { mode: 'recent', count: 10 }));
    this.register('mostRecent', () => this.debugTarget({ mode: 'recent', count: 1 }));
    this.register('export', () => this.exportLaunchConfig());
  }

  /**
   * On IPC trigger to run a target
   */
  onEvent(ev: TargetEvent<{ name: string, args: string[] }>): Promise<void> {
    return this.debugTarget(ev.data.name, ev.data.args);
  }
}