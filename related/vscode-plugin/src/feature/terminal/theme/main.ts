import timers from 'node:timers/promises';
import vscode from 'vscode';

import { Env } from '@travetto/base';
import { Activatible } from '../../../core/activation';
import { BaseFeature } from '../../base';
import { RunUtil } from '../../../core/run';

@Activatible('@travetto/terminal', 'theme')
export class TerminalThemeFeature extends BaseFeature {

  /** Read theme using webview panel */
  async #getColorTheme(): Promise<{ light: boolean, highContrast: boolean }> {
    const subs: { dispose(): unknown }[] = [];
    const panel = vscode.window.createWebviewPanel('theme-detector', '',
      { preserveFocus: true, viewColumn: vscode.ViewColumn.Beside, },
      { enableScripts: true, localResourceRoots: [], },
    );
    subs.push(panel);

    const reading = new Promise<string>(res => subs.push(panel.webview.onDidReceiveMessage(res, undefined)));
    panel.webview.html = '<body onload="acquireVsCodeApi().postMessage(document.body.className)">';
    const final = await Promise.race([reading, timers.setTimeout(1000).then(x => undefined)]);
    for (const sub of subs) {
      sub.dispose();
    }

    return {
      light: (!!final && /vscode[^ ]*-light/.test(final)),
      highContrast: /vscode-high-contrast/.test(final ?? '')
    };
  }

  /** Update general data for theme */
  async #writeTheme(ctx: vscode.ExtensionContext): Promise<void> {
    const theme = await this.#getColorTheme();
    const color = theme.light ? '0;15' : '15;0';
    const depth = theme?.highContrast ? 1 : 3;

    RunUtil.registerEnvVars(ctx, {
      ...Env.COLORFGBG.export(color),
      ...Env.FORCE_COLOR.export(depth),
    });
  }

  async activate(ctx: vscode.ExtensionContext): Promise<void> {
    await this.#writeTheme(ctx);

    // Update config on change
    ctx.subscriptions.push(
      vscode.window.onDidChangeActiveColorTheme(() => this.#writeTheme(ctx))
    );
  }
}