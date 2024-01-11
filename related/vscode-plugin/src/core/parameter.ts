import vscode from 'vscode';
import fs from 'node:fs/promises';

import { CliCommandInput } from '@travetto/cli';
import { ExecUtil, StreamUtil } from '@travetto/base';
import { path } from '@travetto/manifest';

import { Workspace } from './workspace';

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
  static #rgPath: string;

  static async #getRgPath(): Promise<string> {
    if (!this.#rgPath) {
      for (const folder of ['node_modules.asar.unpacked', 'node_modules']) {
        for (const mod of ['vscode-ripgrep', '@vscode/ripgrep']) {
          const file = path.resolve(vscode.env.appRoot, folder, mod, 'bin', 'rg');
          if (await fs.stat(file).catch(() => false)) {
            this.#rgPath = file;
            break;
          }
        }
      }
    }
    if (!this.#rgPath) {
      throw new Error('Unable to find ripgrep path');
    }
    return this.#rgPath;
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
   * @param conf
   */
  static buildQuickInput(conf: InputWithMeta): vscode.InputBox {
    return this.buildQuick(conf, vscode.window.createInputBox);
  }

  /**
   * Create a quick pick list
   * @param conf The parameter to pick for
   * @param choices List of choices
   */
  static buildQuickPickList(conf: InputWithMeta, choices: string[]): vscode.QuickPick<vscode.QuickPickItem> {
    const qp = this.buildQuick(conf, vscode.window.createQuickPick);
    qp.title = `Select ${conf.param.description || conf.param.name}`;
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
  static async getFile(conf: InputWithMeta, root?: string): Promise<string | undefined> {
    const disposables: vscode.Disposable[] = [];
    const rgPath = await this.#getRgPath();
    const baseArgs = ['--max-count', '50', '--files'];
    const quote = process.platform === 'win32' ? '"' : '\'';
    const cwd = root ?? Workspace.uri.fsPath;
    const placeholder = 'Type to search for files';
    const exts: string[] = conf.param.fileExtensions ?? [];

    try {
      return await new Promise<string | undefined>((resolve, reject) => {
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
            const proc = ExecUtil.spawn(rgPath, args, {
              stdio: [0, 'pipe', 2],
              shell: true,
              cwd,
              catchAsResult: true,
            });
            StreamUtil.onLine(proc.process.stdout!, item => items.push({ label: item, description: path.resolve(cwd, item) }));
            await proc.result;
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
   * @param conf
   */
  static getQuickInput(conf: InputWithMeta): Promise<string> {
    return this.getInput(this.buildQuickInput(conf));
  }

  /**
   * Get quick pick list
   *
   * @param conf
   * @param choices
   */
  static getQuickPickList(conf: InputWithMeta, choices: string[]): Promise<string> {
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
  static async getParameter(conf: InputWithMeta): Promise<string | undefined> {
    switch (conf.param.type) {
      case 'number': return this.getQuickInput(conf);
      case 'boolean': return this.getQuickPickList(conf, ['yes', 'no']).then(x => `${x === 'yes'}`);
      case 'file': return this.getFile(conf);
      case 'string':
      default: {
        if (conf.param.choices) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return this.getQuickPickList(conf, conf.param.choices as string[]);
        } else {
          return this.getQuickInput(conf);
        }
      }
    }
  }
}