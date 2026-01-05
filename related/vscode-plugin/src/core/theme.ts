import * as vscode from 'vscode';
import path from 'node:path';
import fs from 'node:fs';

type TokenColor = {
  scope: string | string[];
  settings: Record<string, string>;
};

type ThemeNode = {
  include?: string;
  colors?: Record<string, string>;
  tokenColors?: TokenColor[];
};

type ThemeRef = { path: string, label: string, id: string };

export class ThemeUtil {

  static #theme: Map<string, string> | undefined;

  static resolveThemePath(themeId: string | undefined): string | undefined {
    for (const extension of vscode.extensions.all) {
      const themes: ThemeRef[] = extension.packageJSON.contributes?.themes;
      const currentTheme = themes?.find((theme) => theme.id === themeId);
      if (currentTheme) {
        return path.join(extension.extensionPath, currentTheme.path);
      }
    }
  }

  static resolveTheme(themeName?: string): Map<string, string> {
    const tokenColors = new Map<string, string>();
    const currentThemePath = this.resolveThemePath(themeName);
    const themePaths: string[] = [];

    if (currentThemePath) {
      themePaths.push(currentThemePath);
    }

    while (themePaths.length > 0) {
      const themePath = themePaths.pop()!;
      const theme: ThemeNode | undefined = JSON.parse(fs.readFileSync(themePath, 'utf8'));
      if (theme?.include) {
        themePaths.push(path.join(path.dirname(themePath), theme.include));
      }
      for (const [key, value] of Object.entries(theme?.colors ?? {})) {
        tokenColors.set(key, value);
      }
      for (const rule of theme?.tokenColors ?? []) {
        if (typeof rule.scope === 'string') {
          for (const [key, value] of Object.entries(rule.settings)) {
            tokenColors.set(`${rule.scope}.${key}`, value);
          }
        } else {
          for (const scope of rule.scope) {
            for (const [key, value] of Object.entries(rule.settings)) {
              tokenColors.set(`${scope}.${key}`, value);
            }

          }
        }
      }
    }
    return tokenColors;
  }

  static getTokenColor(token: string): string | undefined {
    this.#theme ??= this.resolveTheme(vscode.workspace.getConfiguration('workbench').get('colorTheme'));
    return this.#theme.get(token);
  }
}