import vscode from 'vscode';

import { AppChoice, ResolvedAppChoice } from './types';
import { Workspace } from '../../../core/workspace';
import { ParameterSelector } from '../../../core/parameter';

type PickItem = vscode.QuickPickItem & { target: AppChoice };

/**
 * Utils for handling app running
 */
export class AppRunUtil {

  /**
   * Build application details for quick pick
   * @param app
   */
  static #buildAppDetail(app: AppChoice): string {
    const detail = [app.description];
    const out = detail.filter(x => !!x).join(' ').trim();
    return out ? `${'\u00A0'.repeat(4)}${out}` : out;
  }

  /**
   * Build application parameters for quick pick
   * @param choice
   */
  static #buildAppParams(choice: AppChoice): string {
    const out = (choice.params ?? [])
      .map((x, i) => {
        let val = choice.inputs[i] !== undefined ? choice.inputs[i] : (x.enum?.values?.join(',') ?? x.default);
        if (x.specifier === 'file' && val) {
          val = `${val}`.replace(Workspace.path, '.');
        }
        return `${x.title || x.name}${val !== undefined ? `=${val}` : ''}`;
      })
      .join(', ');
    return out;
  }

  /**
  * Build quick pick item
  * @param choice
  */
  static #buildQuickPickItem(choice: AppChoice): PickItem | undefined {
    const params = this.#buildAppParams(choice);
    const detail = choice.key ? undefined : this.#buildAppDetail(choice);

    return {
      label: `${choice.key ? '' : '$(gear) '}${choice.globalName}`,
      detail,
      description: params,
      target: choice
    };
  }

  /**
   * Select application parameters
   * @param choice
   */
  static async #selectParameters(choice: AppChoice): Promise<string[] | undefined> {
    const all = choice.params;
    const selected: string[] = [];

    for (let i = 0; i < all.length; i++) {
      const param = all[i]!;
      const res = await ParameterSelector.getParameter({
        param,
        total: all.length,
        step: i + 1,
        input: choice.inputs[i]
      });

      if (res === undefined) {
        if (!param.required) {
          selected.push('');
        } else {
          return undefined;
        }
      } else {
        selected.push(res);
      }
    }

    if (selected.length < all.length) {
      throw new Error(`Missing arguments for ${choice.name}`);
    }

    return selected;
  }

  /**
   * Get list of applications
   */
  static async getAppList(module: string): Promise<AppChoice[]> {
    if (!Workspace.isInstalled(module)) {
      throw new Error(`Unable to collect application list: ${module} is not installed`);
    }

    const res = Workspace.spawnCli('main', [`${module}/support/bin/list`], { stdio: [0, 'pipe', 'pipe', 'ignore'], catchAsResult: true });
    const data = await res.result;
    if (!data.valid) {
      throw new Error(`Unable to collect application list: ${data.message}`);
    }
    const choices: AppChoice[] = JSON.parse(data.stdout);
    for (const choice of choices) {
      choice.inputs = [];
      choice.file = (await Workspace.getSourceFromImport(choice.import))!;
    }
    return choices;
  }

  /**
   * Select an app
   * @param title
   * @param choices
   */
  static async chooseApp(title: string, choices: AppChoice[], resolveParameters?: true): Promise<ResolvedAppChoice | undefined>;
  static async chooseApp(title: string, choices: AppChoice[], resolveParameters: false): Promise<AppChoice | undefined>;
  static async chooseApp(title: string, choices: AppChoice[], resolveParameters?: boolean): Promise<AppChoice | ResolvedAppChoice | undefined> {
    const items = choices
      .map(x => this.#buildQuickPickItem(x))
      .filter((x): x is PickItem => !!x);

    const res = await ParameterSelector.getObjectQuickPickList(title, items);
    let choice: AppChoice | undefined = res?.target;
    if (choice && resolveParameters && !choice.resolved) {
      const inputs = await this.#selectParameters(choice);
      if (inputs) {
        const key = `${choice.targetId}#${choice.name}:${inputs.join(',')}`;
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
  static getLaunchConfig(choice: ResolvedAppChoice): ReturnType<(typeof Workspace)['generateLaunchConfig']> {
    const args = choice.inputs.map(x => `${x}`.replace(Workspace.path, '.')).join(', ');

    return Workspace.generateLaunchConfig({
      name: `[Travetto] ${choice.name}${args ? `: ${args}` : ''}`,
      useCli: true,
      main: 'run',
      args: [choice.name, ...choice.inputs],
      cliModule: choice.module,
    });
  }


  /**
   * Start debugging session for application
   * @param choice
   * @param line
   */
  static async debugApp(choice: ResolvedAppChoice, line?: number): Promise<void> {
    try {
      if (line) {
        const editor = vscode.window.visibleTextEditors.find(x => x.document.fileName === choice.file);
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
}