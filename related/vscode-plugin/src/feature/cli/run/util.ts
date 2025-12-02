import vscode from 'vscode';
import { spawn } from 'child_process';

import { ExecUtil, Env } from '@travetto/runtime';

import { RunChoice, ResolvedRunChoice } from './types.ts';
import { Workspace } from '../../../core/workspace.ts';
import { ParameterSelector } from '../../../core/parameter.ts';
import { LaunchConfig } from '../../../core/types.ts';
import { RunUtil } from '../../../core/run.ts';

type PickItem = vscode.QuickPickItem & { target: RunChoice };

type ModuleGraphItem<T> = { name: string, children: T, local?: boolean };

/**
 * Utils for handling cli running
 */
export class CliRunUtil {

  /**
   * Build choice details for quick pick
   * @param choice
   */
  static #buildChoiceDetail(choice: RunChoice): string {
    const detail = [choice.description];
    const out = detail.filter(x => !!x).join(' ').trim();
    return out ? `${'\u00A0'.repeat(4)}${out}` : out;
  }

  /**
   * Build choice parameters for quick pick
   * @param choice
   */
  static #buildChoiceParams(choice: RunChoice): string {
    const out = (choice.args ?? [])
      .map((x, i) => {
        const val = choice.inputs[i] !== undefined ? choice.inputs[i] : (x.choices?.join(',') ?? x.default);
        return `${x.description || x.name}${val !== undefined ? `=${val}` : ''}`;
      })
      .join(', ');
    return out;
  }

  /**
  * Build quick pick item
  * @param choice
  */
  static #buildQuickPickItem(choice: RunChoice): PickItem | undefined {
    const params = this.#buildChoiceParams(choice);
    const detail = choice.key ? undefined : this.#buildChoiceDetail(choice);

    return {
      label: `${choice.key ? '' : '$(gear) '}${choice.prettyName ?? choice.name}`,
      detail,
      description: params,
      target: choice
    };
  }

  /**
   * Select application parameters
   * @param choice
   */
  static async #selectParameters(choice: RunChoice): Promise<string[] | undefined> {
    const all = choice.args;
    const selected: string[] = [];

    for (let i = 0; i < all.length; i++) {
      const param = all[i]!;
      const result = await ParameterSelector.getParameter({
        param,
        total: all.length,
        step: i + 1,
        input: choice.inputs[i]
      });

      if (result === undefined) {
        if (!param.required) {
          selected.push('');
        } else {
          return undefined;
        }
      } else {
        selected.push(result);
      }
    }

    if (selected.length < all.length) {
      throw new Error(`Missing arguments for ${choice.description}`);
    }

    return selected;
  }

  /** Spawn CLI  */
  static async #startCli(command: string, args: string[], action: string): Promise<{ stdout: string, stderr: string }> {
    const proc = spawn('node', [RunUtil.cliFile, command, ...args], {
      stdio: [0, 'pipe', 'pipe', 'ignore'],
      cwd: Workspace.path,
      env: { ...process.env, ...RunUtil.buildEnv(), ...Env.TRV_QUIET.export(true) }
    });
    const data = await ExecUtil.getResult(proc, { catch: true });
    if (!data.valid) {
      throw new Error(`Unable to ${action}: ${data.message}`);
    }
    return data;
  }

  /**
   * Get list of modules
   */
  static async getModules(): Promise<ModuleGraphItem<Set<string>>[]> {
    const data = await this.#startCli('repo:list', ['-f', 'json'], 'collect module list');
    try {
      const result: ModuleGraphItem<string[]>[] = JSON.parse(data.stdout);
      return result.map(x => ({ name: x.name, children: new Set(x.children), local: !!x.local }));
    } catch {
      throw new Error(`Unable to collect module list: ${data.stderr || data.stdout}`);
    }
  }

  /**
   * Get list of run choices
   */
  static async getChoices(): Promise<RunChoice[]> {
    const data = await this.#startCli('cli:schema', [], 'get cli command list');
    let choices: RunChoice[] = JSON.parse(data.stdout);
    let modules: ModuleGraphItem<Set<string>>[];

    // Only return `run:* targets
    choices = choices.filter(x => x.runTarget);

    const output: RunChoice[] = [];
    for (const choice of choices) {
      choice.inputs = [];
      const moduleFlag = choice.flags.find(x => x.type === 'module');
      if (moduleFlag?.required) {
        modules ??= await this.getModules();
        for (const module of modules.filter(m => m.local && m.children.has(choice.module))) {
          output.push({
            ...choice,
            prettyName: `${choice.name} [${module.name}]`,
            inputFlags: ['--module', module.name]
          });
        }
        if (modules.find(m => m.local && m.name === choice.module)) {
          output.push({
            ...choice,
            prettyName: `${choice.name} [${choice.module}]`,
            inputFlags: ['--module', choice.module]
          });
        }
      } else {
        output.push(choice);
      }
    }
    return output;
  }

  /**
   * Choose a run target
   * @param title
   * @param choices
   */
  static async makeChoice(title: string, choices: RunChoice[]): Promise<ResolvedRunChoice | undefined>;
  static async makeChoice(title: string, choices: RunChoice[]): Promise<RunChoice | undefined>;
  static async makeChoice(title: string, choices: RunChoice[]): Promise<RunChoice | ResolvedRunChoice | undefined> {
    const items = choices
      .map(x => this.#buildQuickPickItem(x))
      .filter(x => !!x);

    const result = await ParameterSelector.getObjectQuickPickList(title, items);
    let choice: RunChoice | undefined = result?.target;
    if (choice && !choice.resolved) {
      const inputs = await this.#selectParameters(choice);
      if (inputs) {
        const key = `${choice.name}:${inputs.join(',')}`;
        choice = { ...choice, inputs, resolved: true, key, time: Date.now() };
      } else {
        choice = undefined;
      }
    }
    return choice;
  }

  /**
   * Get full launch config
   * @param choice
   */
  static getLaunchConfig(choice: ResolvedRunChoice): LaunchConfig {
    const args = choice.inputs.map(x => `${x}`.replace(Workspace.path, '.')).join(', ');

    return {
      name: `[Travetto] ${choice.name}${args ? `: ${args}` : ''}`,
      useCli: true,
      main: choice.name,
      args: [...choice.inputFlags ?? [], ...choice.inputs],
    };
  }
}