import vscode from 'vscode';
import fs from 'node:fs/promises';

import { path } from '@travetto/manifest';

import { Activatible } from '../../../core/activation';
import { Workspace } from '../../../core/workspace';
import { BaseFeature } from '../../base';

interface Link extends vscode.TerminalLink {
  file: string;
  line?: number | string;
  cls?: string;
}

const FILE_CLASS_REGEX = /([a-z_\-\/@]+)[:\/]((?:src|support|bin|test|doc)\/[a-z_0-9\/.\-]+)(:\d+|￮[$_a-z0-9]+)?/gi;

/**
 * Logging workspace
 */
@Activatible('@travetto/log', true)
export class LogFeature extends BaseFeature {

  #importToFile = new Map<string, string | undefined>();

  async getSourceFromImport(imp: string): Promise<string | undefined> {
    if (!this.#importToFile.has(imp)) {
      let file: undefined | string;
      if (imp.startsWith(Workspace.moduleName)) {
        file = path.resolve(Workspace.path, imp.replace(Workspace.moduleName, '.'));
      } else {
        try {
          file = Workspace.resolveImport(imp);
        } catch {
          try {
            file = Workspace.resolveImport(imp.replace(/[.]js$/, '.ts').replace(/[.]jsx$/, '.tsx'));
          } catch { }
        }
      }
      this.#importToFile.set(imp, file);
    }
    return this.#importToFile.get(imp);
  }


  /**
   * Handle a terminal link being clicked
   */
  async handleTerminalLink({ file, line, cls }: Link): Promise<void> {
    if (cls && !line) {
      line = (await fs.readFile(file, 'utf8')).split(/\n/).findIndex(x => x.includes(`class ${cls}`));
      if (line >= 0) {
        line += 1;
      }
    }

    const url = vscode.Uri.parse(`file://${file}#${line}`);
    await vscode.commands.executeCommand('vscode.open', url);
  }

  /**
   * Determine terminal links on demand
   */
  async provideTerminalLinks(context: vscode.TerminalLinkContext): Promise<Link[]> {
    const out: Link[] = [];

    for (const match of context.line.matchAll(FILE_CLASS_REGEX)) {
      const [full, mod, pth, suffix = ''] = match;
      const sourceFile = await this.getSourceFromImport(`${mod}/${pth}`);
      if (sourceFile) {
        const suffixType = suffix.includes('￮') ? 'class' : suffix.includes(':') ? 'file-numbered' : 'file';
        const type = suffixType === 'class' ? 'Class' : 'File';
        out.push({
          startIndex: context.line.indexOf(full),
          length: full.length,
          tooltip: `Travetto ${type}: ${mod}/${pth}${suffix}`,
          file: sourceFile,
          line: suffixType === 'file-numbered' ? suffix.split(':')[1] : undefined,
          cls: suffixType === 'class' ? suffix.split('￮')[1] : undefined
        });
      }
    }
    return out;
  }

  /**
   * On initial activation
   */
  activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.registerTerminalLinkProvider(this)
    );
  }
}