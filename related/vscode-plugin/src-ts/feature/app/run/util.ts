import * as vscode from 'vscode';
import { AppChoice } from './types';
import { Workspace } from '../../../core/workspace';
import { ParameterSelector } from '../../../core/parameter';

type PickItem = vscode.QuickPickItem & { target: AppChoice };

/**
 * Utils for handling app selection
 */
export class AppSelectorUtil {

  /**
   * Build application details for quick pick
   * @param app
   */
  static buildAppDetail(app: AppChoice) {
    const detail = [app.description];
    const out = detail.filter(x => !!x).join(' ').trim();
    return out ? `${'\u00A0'.repeat(4)}${out}` : out;
  }

  /**
   * Build application parameters for quick pick
   * @param choice
   */
  static buildAppParams(choice: AppChoice) {
    const out = choice.params
      .map((x, i) => {
        let val = choice.inputs[i] !== undefined ? choice.inputs[i] : (x.meta?.choices?.join(',') ?? x.def);
        if (x.subtype === 'file' && val) {
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
  static buildQuickPickItem(choice: AppChoice): PickItem | undefined {
    const params = this.buildAppParams(choice);
    const detail = choice.key ? undefined : this.buildAppDetail(choice);

    return {
      label: `${choice.key ? '' : '$(gear) '}${choice.name}`,
      detail,
      description: params,
      target: choice
    };
  }

  /**
   * Select an app
   * @param title
   * @param choices
   */
  static async resolveApp(title: string, choices: AppChoice[]) {
    const items = choices
      .map(x => {
        x.params = x.params || [];
        return x;
      })
      .map(x => this.buildQuickPickItem(x))
      .filter(x => !!x) as PickItem[];

    const res = await ParameterSelector.getObjectQuickPickList(title, items);
    return res?.target;
  }

  /**
   * Select application parameters
   * @param choice
   */
  static async resolveParameters(choice: AppChoice): Promise<string[] | undefined> {
    const all = choice.params;
    const selected = [];

    choice.inputs = choice.inputs || [];

    for (let i = 0; i < all.length; i++) {
      const param = all[i];
      const res = await ParameterSelector.getParameter({
        param,
        total: all.length,
        step: i + 1,
        input: choice.inputs[i]
      });

      if (res === undefined) {
        if (param.optional) {
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
   * Handle application choices
   * @param title
   * @param choices
   */
  static async resolveChoices(title: string, choices: AppChoice[] | AppChoice) {
    const choice = Array.isArray(choices) ? (await this.resolveApp(title, choices)) : choices;

    if (!choice) {
      return;
    }

    if (!choice.key && choice.params && choice.params.length) {
      const inputs = await this.resolveParameters(choice);

      if (inputs === undefined) {
        return;
      }

      choice.inputs = inputs;

      return choice;
    } else {
      return choice;
    }
  }
}