import vscode from 'vscode';
import fs from 'fs/promises';

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

    context.line
      // Log reference
      .replace(/([^:]+):(?:src|support|bin|test|doc)\/([a-z\/.\-]+)(:\d+|￮[$A-Z][a-zA-Z0-9]+)/g, (_, mod, path, suffix) => {
        if (!path.endsWith('.ts')) {
          path = `${path}.ts`;
        }
        const file = Workspace.resolve(`${mod}/${path}`);

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
  activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.registerTerminalLinkProvider(this)
    );
  }
}