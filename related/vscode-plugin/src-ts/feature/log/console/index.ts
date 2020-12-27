import * as vscode from 'vscode';
import * as fs from 'fs';

import { Activatible } from '../../../core/activation';
import { Workspace } from '../../../core/workspace';
import { BaseFeature } from '../../base';

interface Link extends vscode.TerminalLink {
  file: string;
  line?: number;
  cls?: string;
}

/**
 * Logging workspace
 */
@Activatible('log')
export class CleanFeature extends BaseFeature {

  base = fs.existsSync(Workspace.resolve('node_modules/@travetto')) ? './node_modules/@travetto' : './module';

  /**
   * Handle a terminal link being clicked
   */
  async handleTerminalLink({ file, line, cls }: Link) {
    if (cls && !line) {
      line = (await fs.promises.readFile(file, 'utf8')).split(/\n/).findIndex(x => x.includes(`class ${cls}`));
      if (line >= 0) {
        line += 1;
      }
    }

    const url = vscode.Uri.parse(`file://${file}#${line}`);
    console.log(url);
    await vscode.commands.executeCommand('vscode.open', url);
  }

  /**
   * Determine terminal links on demand
   */
  async provideTerminalLinks(context: vscode.TerminalLinkContext) {
    const out: Link[] = [];
    const cwd = await fs.promises.readlink(`/proc/${await context.terminal.processId}/cwd`);
    context.line
      // Log reference
      .replace(/(@trv:[^\/]+|(?:[.][/])(?:src|support|bin|test|test-support|test-extension))\/([a-z\/.\-]+)(:\d+|￮[$A-Z][a-zA-Z0-9]+)/g, (_, mod, path, suffix) => {
        let file: string;
        if (mod.startsWith('@trv')) {
          mod = mod.split('@trv:')[1];
          if (!/^(support|bin|test|test-support|test-extension)/.test(path)) {
            path = `src/${path}`;
          }
          file = Workspace.resolve(`${this.base}/${mod}/${path}.ts`);
        } else {
          file = `${cwd}/${mod}/${path}.ts`;
        }
        const type = suffix.includes(':') ? 'File' : 'Class';

        out.push({
          startIndex: context.line.indexOf(_),
          length: _.length,
          tooltip: `Travetto ${type}: ${mod}/${path}${suffix}`,
          file,
          line: type === 'File' ? suffix.split(':')[1] : undefined,
          cls: type === 'Class' ? suffix.split('￮')[1] : undefined
        });
        return '';
      });

    return out;
  }

  /**
   * On initial activation
   */
  activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.window.registerTerminalLinkProvider(this)
    );
  }
}