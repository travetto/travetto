import vscode from 'vscode';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { CliCommandInput } from '@travetto/cli';
import { ExecUtil } from '@travetto/runtime';

import { Workspace } from './workspace.ts';

/**
 * Input parameter with metadata
 */
interface InputWithMeta {
  param: CliCommandInput;
  total?: number;
  step?: number;
  input?: string;
}

type Complex = vscode.InputBox | vscode.QuickPick<vscode.QuickPickItem>;

/**
 * Selects a parameter
 */
export class ParameterSelector {
  static #ripGrepPath: string;

  static async #getRipGrepPath(): Promise<string> {
    if (!this.#ripGrepPath) {
      for (const folder of ['node_modules.asar.unpacked', 'node_modules']) {
        for (const mod of ['vscode-ripgrep', '@vscode/ripgrep']) {
          const file = path.resolve(vscode.env.appRoot, folder, mod, 'bin', 'rg');
          if (await fs.stat(file).catch(() => false)) {
            this.#ripGrepPath = file;
            break;
          }
        }
      }
    }
    if (!this.#ripGrepPath) {
      throw new Error('Unable to find ripgrep path');
    }
    return this.#ripGrepPath;
  }

  /**
   * Create the input handler
   * @param provider Input Parameter provider
   * @param config The configuration for the parameter
   */
  static buildQuick<T extends Complex>(config: InputWithMeta, provider: () => T): T {
    const qp = provider();
    qp.ignoreFocusOut = true;
    qp.step = config.step;
    qp.totalSteps = config.total;
    qp.value = (config.input || (config.param.default !== undefined ? `${config.param.default}` : undefined))!;
    qp.placeholder = qp.title;
    qp.title = `Enter value for ${config.param.description || config.param.name}`;
    return qp;
  }

  /**
   * Build quick input
   * @param input
   */
  static buildQuickInput(input: InputWithMeta): vscode.InputBox {
    return this.buildQuick(input, vscode.window.createInputBox);
  }

  /**
   * Create a quick pick list
   * @param input The parameter to pick for
   * @param choices List of choices
   */
  static buildQuickPickList(input: InputWithMeta, choices: unknown[]): vscode.QuickPick<vscode.QuickPickItem> {
    const quickPick = this.buildQuick(input, vscode.window.createQuickPick);
    quickPick.title = `Select ${input.param.description || input.param.name}`;
    quickPick.items = choices.map(x => ({ label: `${x}` }));
    quickPick.canSelectMany = false;

    if (quickPick.value !== undefined && input.param.type === 'boolean') {
      quickPick.value = `${quickPick.value}` === 'true' ? 'yes' : 'no';
    }

    if (quickPick.value !== undefined) {
      quickPick.activeItems = quickPick.items.filter(x => x.label === quickPick.value);
    }

    quickPick.value = undefined!;

    return quickPick;
  }

  /**
   * Convert input to resolvable value
   * @param input
   */
  static async getInputComplex<T extends Complex, U>(input: T, transform: (value: T) => U): Promise<U> {
    input.show();
    return new Promise<U>((resolve) => {
      input.onDidAccept(() => resolve(transform(input!)));
    }).finally(() => {
      input.hide();
      input.dispose();
    });
  }

  /**
   * Convert input to resolvable value
   * @param input
   */
  static async getInput<T extends Complex>(input: T): Promise<string> {
    return this.getInputComplex(input, x => x.value);
  }

  /**
   * Prompt for a file
   * @param config The parameter to look for
   * @param root The root to search in
   */
  static async getFile(config: InputWithMeta, root?: string): Promise<string | undefined> {
    const disposables: vscode.Disposable[] = [];
    const ripGrepPath = await this.#getRipGrepPath();
    const baseArgs = ['--max-count', '50', '--files'];
    const quote = process.platform === 'win32' ? '"' : '\'';
    const cwd = root ?? Workspace.uri.fsPath;
    const placeholder = 'Type to search for files';
    const exts: string[] = config.param.fileExtensions ?? [];

    try {
      return await new Promise<string | undefined>((resolve) => {
        const input = vscode.window.createQuickPick<{ label: string, description: string }>();
        input.placeholder = exts.length ? `${placeholder} (${exts.map(x => `.${x}`).join(', ')})` : placeholder;

        disposables.push(
          input.onDidChangeValue(async value => {
            if (!value) {
              input.items = [];
              return;
            }
            value = value.replace(/[*?]/g, '').replace(/[.]$/, '');

            const fileQueries = exts.length ? exts.map(ext => `**/*${value}*.${ext}`) : [`*${value}*`];
            const dirQueries = exts.length ? exts.map(ext => `**/*${value}*/**/*.${ext}`) : [`**/*${value}*/**`];
            const query = `{${[...fileQueries, ...dirQueries].join(',')}}`;

            const args = [...baseArgs, '-g', [quote, query, quote].join('')];

            input.busy = true;
            const items: { label: string, description: string }[] = [];
            const subProcess = spawn(ripGrepPath, args, { stdio: [0, 'pipe', 2], shell: true, cwd, });

            if (subProcess.stdout) {
              ExecUtil.readLines(subProcess.stdout,
                item => items.push({ label: item, description: path.resolve(cwd, item.trim()) }));
            }
            await ExecUtil.getResult(subProcess, { catch: true });
            input.items = items;
            input.busy = false;
          }),
          input.onDidChangeSelection(items => {
            if (items[0]) {
              resolve(items[0].description);
            }
            input.hide();
          }),
          input.onDidHide(() => {
            resolve(undefined);
            input.dispose();
          })
        );
        input.show();
      });
    } finally {
      disposables.forEach(d => d.dispose());
    }
  }

  /**
   * Get quick pick input
   * @param input
   */
  static getQuickInput(input: InputWithMeta): Promise<string> {
    return this.getInput(this.buildQuickInput(input));
  }

  /**
   * Get quick pick list
   *
   * @param input
   * @param choices
   */
  static getQuickPickList(input: InputWithMeta, choices: unknown[]): Promise<string> {
    return this.getInputComplex(
      this.buildQuickPickList(input, choices),
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

    return this.getInputComplex(qp, item => item.activeItems[0]);
  }

  /**
   * Build input depending on provided configuration
   * @param input Parameter configuration
   */
  static async getParameter(input: InputWithMeta): Promise<string | undefined> {
    switch (input.param.type) {
      case 'number': return this.getQuickInput(input);
      case 'boolean': return this.getQuickPickList(input, ['yes', 'no']).then(x => `${x === 'yes'}`);
      case 'file': return this.getFile(input);
      case 'string':
      default: {
        if (input.param.choices) {
          return this.getQuickPickList(input, input.param.choices);
        } else {
          return this.getQuickInput(input);
        }
      }
    }
  }
}