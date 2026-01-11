import * as vscode from 'vscode';
import fs from 'node:fs/promises';

import { Activatible } from '../../../core/activation.ts';
import { Workspace } from '../../../core/workspace.ts';
import { BaseFeature } from '../../base.ts';

interface Link extends vscode.TerminalLink {
  file: string;
  line?: number | string;
  cls?: string;
}

const MODULE_REGEX = /(@[a-z0-9\-]+\/[a-z0-9\-]+)[^\/]/gi;
const FILE_CLASS_REGEX = /((?:@[a-z_\-]+[/])[a-z_\-]+)[:\/]((?:src|support|bin|test|doc)\/[a-z_0-9\/.\-]+)(:\d+|#[$_a-z0-9]+)?/gi;

/**
 * Logging workspace
 */
@Activatible('@travetto/log', true)
export class LogFeature extends BaseFeature {

  /**
   * Handle a terminal link being clicked
   */
  async handleTerminalLink({ file, line, cls }: Link): Promise<void> {
    if (cls && !line) {
      line = (await fs.readFile(file, 'utf8')).split(/\n/).findIndex(fileLine => fileLine.includes(`class ${cls}`));
      if (line >= 0) {
        line += 1;
      }
    }

    let suffix = '';
    if (line) {
      suffix = `#${line}`;
    }

    const url = vscode.Uri.parse(`file://${file}${suffix}`);
    await vscode.commands.executeCommand('vscode.open', url);
  }

  /**
   * Determine terminal links on demand
   */
  async provideTerminalLinks(context: vscode.TerminalLinkContext): Promise<Link[]> {
    const out: Link[] = [];

    for (const match of context.line.matchAll(FILE_CLASS_REGEX)) {
      const [full, module, relativeFile, suffix = ''] = match;
      const sourceFile = Workspace.resolveManifestFileFromImport(`${module}/${relativeFile}`);
      if (sourceFile) {
        const suffixType = suffix.includes('#') ? 'class' : suffix.includes(':') ? 'file-numbered' : 'file';
        const type = suffixType === 'class' ? 'Class' : 'File';
        out.push({
          startIndex: match.index!,
          length: full.length,
          tooltip: `Travetto ${type}: ${module}/${relativeFile}${suffix}`,
          file: sourceFile,
          line: suffixType === 'file-numbered' ? suffix.split(':')[1] : undefined,
          cls: suffixType === 'class' ? suffix.split('#')[1] : undefined
        });
      }
    }
    for (const match of context.line.matchAll(MODULE_REGEX)) {
      const [, module] = match;
      const file = Workspace.resolveManifestFileFromImport(`${module}/package.json`);
      if (file) {
        out.push({ startIndex: match.index!, length: module.length, file });
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