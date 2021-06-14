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
@Activatible('log', true)
export class LogFeature extends BaseFeature {

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
      .replace(/(@trv:[^\/]+|(?:[.][/])(?:src|support|bin|test(?:-support|-isolated)?))\/([a-z\/.\-]+)(:\d+|￮[$A-Z][a-zA-Z0-9]+)/g, (_, mod, path, suffix) => {
        let file: string;
        if (!path.endsWith('.ts')) {
          path = `${path}.ts`;
        }
        if (mod.startsWith('@trv')) {
          mod = mod.split('@trv:')[1];
          if (!/^(support|bin|test|test(?:-support|-isolated)?)/.test(path)) {
            path = `src/${path}`;
          }
          file = Workspace.resolve(`@travetto/${mod}/${path}`);
        } else {
          file = `${cwd}/${mod}/${path}`;
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