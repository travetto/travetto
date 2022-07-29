import * as vscode from 'vscode';

import { Workspace } from './workspace';
import { FieldConfig } from './types';

/**
 * Input parameter with metadata
 */
interface ParamWithMeta {
  param: FieldConfig;
  total?: number;
  step?: number;
  input?: string;
}

type Complex = vscode.InputBox | vscode.QuickPick<vscode.QuickPickItem>;

/**
 * Selects a parameter
 */
export class ParameterSelector {
  /**
   * Create the input handler
   * @param provider Input Parameter provider
   * @param config The configuration for the parameter
   */
  static buildQuick<T extends Complex>(config: ParamWithMeta, provider: () => T): T {
    const qp = provider();
    qp.ignoreFocusOut = true;
    qp.step = config.step;
    qp.totalSteps = config.total;
    qp.value = (config.input || (config.param.default !== undefined ? `${config.param.default}` : undefined))!;
    qp.placeholder = qp.title;
    qp.title = `Enter value for ${config.param.title || config.param.name}`;
    return qp;
  }

  /**
   * Build quick input
   * @param conf
   */
  static buildQuickInput(conf: ParamWithMeta): vscode.InputBox {
    return this.buildQuick(conf, vscode.window.createInputBox);
  }

  /**
   * Create a quick pick list
   * @param conf The parameter to pick for
   * @param choices List of choices
   */
  static buildQuickPickList(conf: ParamWithMeta, choices: string[]): vscode.QuickPick<vscode.QuickPickItem> {
    const qp = this.buildQuick(conf, vscode.window.createQuickPick);
    qp.title = `Select ${conf.param.title || conf.param.name}`;
    qp.items = choices.map(x => ({ label: x }));
    qp.canSelectMany = false;

    if (qp.value !== undefined && conf.param.type === 'boolean') {
      qp.value = `${qp.value}` === 'true' ? 'yes' : 'no';
    }

    if (qp.value !== undefined) {
      qp.activeItems = qp.items.filter(x => x.label === qp.value);
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    qp.value = undefined as unknown as string;

    return qp;
  }

  /**
   * Convert input to resolvable value
   * @param input
   */
  static async getInput<T extends Complex, U = string>(input: T, transform?: (val: T) => U): Promise<U> {
    input.show();
    return new Promise<U>((resolve) => {
      input.onDidAccept(() =>
        resolve(transform ?
          transform(input!) :
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          input.value as unknown as U
        )
      );
    }).finally(() => {
      input.hide();
      input.dispose();
    });
  }

  /**
   * Prompt for a file
   * @param conf The parameter to look for
   * @param root The root to search in
   */
  static async getFile(conf: ParamWithMeta, root?: string): Promise<string | undefined> {
    const res = await vscode.window.showOpenDialog({
      defaultUri: root ? vscode.Uri.file(root) : Workspace.folder.uri,
      openLabel: `Select ${conf.param.title || conf.param.name}`,
      canSelectFiles: true,
      canSelectMany: false
    });
    return res === undefined ? res : res[0].fsPath;
  }

  /**
   * Get quick pick input
   * @param conf
   */
  static getQuickInput(conf: ParamWithMeta): Promise<string> {
    return this.getInput(this.buildQuickInput(conf));
  }

  /**
   * Get quick pick list
   *
   * @param conf
   * @param choices
   */
  static getQuickPickList(conf: ParamWithMeta, choices: string[]): Promise<string> {
    return this.getInput(
      this.buildQuickPickList(conf, choices),
      x => x.value ?? x.selectedItems[0].label);
  }

  /**
   * Display the quick pick dialog
   * @param title
   * @param items
   */
  static getObjectQuickPickList<T extends vscode.QuickPickItem>(title: string, items: T[]): Promise<T> {
    const qp = vscode.window.createQuickPick<T>();
    qp.ignoreFocusOut = true;
    qp.placeholder = 'Select ...';
    qp.title = title;
    qp.items = items;

    return this.getInput(qp, v => v.activeItems[0] && v.activeItems[0]);
  }

  /**
   * Build input depending on provided configuration
   * @param conf Parameter configuration
   */
  static async getParameter(conf: ParamWithMeta): Promise<string | undefined> {
    switch (conf.param.type) {
      case 'number': return this.getQuickInput(conf);
      case 'boolean': return this.getQuickPickList(conf, ['yes', 'no']).then(x => `${x === 'yes'}`);
      case 'string':
      default: {
        if (conf.param.enum) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return this.getQuickPickList(conf, conf.param.enum?.values as string[] ?? []);
        } else if (conf.param.specifier === 'file') {
          return this.getFile(conf);
        } else {
          return this.getQuickInput(conf);
        }
      }
    }
  }
}