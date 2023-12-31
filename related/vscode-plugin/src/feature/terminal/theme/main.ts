import vscode from 'vscode';

import { Env } from '@travetto/base';
import { Activatible } from '../../../core/activation';
import { BaseFeature } from '../../base';
import { RunUtil } from '../../../core/run';

@Activatible('@travetto/terminal', 'theme')
export class TerminalThemeFeature extends BaseFeature {

  /** Read theme  */
  async #getColorTheme(): Promise<{ light: boolean, highContrast: boolean }> {
    const kind = vscode.window.activeColorTheme.kind;
    return {
      light: kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight,
      highContrast: kind === vscode.ColorThemeKind.HighContrast || kind === vscode.ColorThemeKind.HighContrastLight
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