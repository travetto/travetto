import * as vscode from 'vscode';

import { Activatible } from '../../../core/activation.ts';
import { ActionStorage } from '../../../core/storage.ts';

import { BaseFeature } from '../../base.ts';
import { EnvDict, TargetEvent } from '../../../core/types.ts';
import { RunUtil } from '../../../core/run.ts';

import { RunChoice } from './types.ts';
import { CliRunUtil } from './util.ts';
import { JSONUtil } from '@travetto/runtime';

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

    return this.#storage.getRecentAndFilterState(count * 2, choice =>
      !choices.some(a => a.name === choice.name)
    )
      .map(choice => choice.data)
      .slice(0, count);
  }

  /**
   * Persist config
   */
  async exportLaunchConfig(): Promise<void> {
    try {
      const choice = await CliRunUtil.makeChoice('Export Run', await this.getValidRecent(10));

      if (!choice) {
        return;
      }

      const config = RunUtil.buildDebugConfig(CliRunUtil.getLaunchConfig(choice));
      const launchConfig = vscode.workspace.getConfiguration('launch');
      const configurations = launchConfig['configurations'];
      configurations.push(config);
      await launchConfig.update('configurations', configurations, false);

      vscode.window.showInformationMessage('Added new configuration to launch.json!');
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : JSONUtil.toUTF8(error));
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
        void this.#storage.set(choice.key!, choice);
        return this.debugTarget(choice, choice.inputs);
      }
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : JSONUtil.toUTF8(error));
    }
  }

  /**
   * Debug the application with the given choices
   * @param title
   * @param apps
   */
  async debugTarget(target: RunChoice | Recent, inputs?: string[]): Promise<void> {
    const choice = 'name' in target ? target : (await this.getValidRecent(1))[0];

    if (choice) {
      this.log.info('Running', choice.name, inputs);
      await RunUtil.debug(CliRunUtil.getLaunchConfig({
        ...choice,
        inputs: inputs ?? choice.inputs ?? [],
        resolved: true,
        key: choice.key ?? '',
        time: choice.time ?? Date.now()
      }));
    } else {
      this.log.info('No target selected');
    }
  }

  /**
   * Register command handlers
   */
  activate(context: vscode.ExtensionContext): void {
    console.log('Registering again?', new Date());
    this.#storage = new ActionStorage<RunChoice>('cli.run', context);

    this.register('new', () => this.chooseAndRun('Run New Command', { mode: 'all' }));
    this.register('recent', () => this.chooseAndRun('Run Recent Command', { mode: 'recent', count: 10 }));
    this.register('mostRecent', () => this.debugTarget({ mode: 'recent', count: 1 }));
    this.register('export', () => this.exportLaunchConfig());
  }

  /**
   * On IPC trigger to run a target
   */
  async onEvent(event: TargetEvent<{ name: string, args: string[], module: string, env: EnvDict }>): Promise<void> {
    const args = event.data.args;
    await RunUtil.debug({
      name: `[Travetto] ${event.data.name}${args ? `: ${args.join(' ')}` : ''}`,
      useCli: true,
      main: event.data.name,
      args,
      module: event.data.module,
      env: event.data.env
    });
  }
}