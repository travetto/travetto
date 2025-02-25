import vscode from 'vscode';

import { Env } from '@travetto/runtime';

import { Activatible } from '../../../core/activation';
import { BaseFeature } from '../../base';
import { RunUtil } from '../../../core/run';

@Activatible('@travetto/terminal', true)
export class TerminalThemeFeature extends BaseFeature {

  darkBackground(): boolean {
    switch (vscode.window.activeColorTheme.kind) {
      case vscode.ColorThemeKind.HighContrastLight:
      case vscode.ColorThemeKind.Light: return false;
      default: return true;
    }
  }

  highContrast(): boolean {
    switch (vscode.window.activeColorTheme.kind) {
      case vscode.ColorThemeKind.Dark:
      case vscode.ColorThemeKind.Light: return false;
      default: return true;
    }
  }

  /** Update general data for theme */
  #writeTheme(ctx: vscode.ExtensionContext): void {
    RunUtil.registerEnvVars(ctx, {
      ...Env.COLORFGBG.export(this.darkBackground() ? '15;0' : '0;15'),
      ...Env.FORCE_COLOR.export(this.highContrast() ? 1 : 3),
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