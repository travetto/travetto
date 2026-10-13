import fs from 'node:fs';
import path from 'node:path';

import * as vscode from 'vscode';

import { Log } from './log';

const log = new Log('theme');

type TokenColor = {
  scope: string | string[];
  settings: Record<string, string>;
};

type ThemeNode = {
  include?: string;
  colors?: Record<string, string>;
  tokenColors?: TokenColor[];
};

type ThemeRef = { path: string; label: string; id: string };

export class ThemeUtil {
  static #rawThemes = new Map<string, { tokens: Map<string, string>; includes: string[] }>();
  static #computedThemes = new Map<string, Map<string, string>[]>();

  static resolveThemePath(themeId: string): string | undefined {
    for (const extension of vscode.extensions.all) {
      const themes: ThemeRef[] = extension.packageJSON.contributes?.themes;
      const currentTheme = themes?.find(theme => theme.id === themeId);
      if (currentTheme) {
        return path.join(extension.extensionPath, currentTheme.path);
      }
    }
  }

  static loadTheme(themePath: string, allowedKeys: Set<string>): { tokens: Map<string, string>; includes: string[] } {
    const tokens = new Map<string, string>();

    const themePathSimple = themePath.split('extensions/')[1] ?? themePath;
    log.info('Reading theme', themePathSimple);

    const theme: ThemeNode | undefined = JSON.parse(fs.readFileSync(themePath, 'utf8'));
    const includes = theme?.include ? [path.join(path.dirname(themePath), theme.include)] : [];

    const addKey = (key: string, value: string) => {
      if (allowedKeys.has(key)) {
        tokens.set(key, value);
      }
    };

    for (const [key, value] of Object.entries(theme?.colors ?? {})) {
      addKey(key, value);
    }
    for (const rule of theme?.tokenColors ?? []) {
      if (typeof rule.scope === 'string') {
        for (const [key, value] of Object.entries(rule.settings)) {
          addKey(`${rule.scope}.${key}`, value);
        }
      } else {
        for (const scope of rule.scope) {
          for (const [key, value] of Object.entries(rule.settings)) {
            addKey(`${scope}.${key}`, value);
          }
        }
      }
    }
    return { tokens, includes };
  }

  static resolveTheme(themeName: string, defaults: Record<string, string>): Map<string, string>[] {
    const themePaths: string[] = [themeName].map(theme => this.resolveThemePath(theme)).filter((file?: string): file is string => !!file);

    const seen = new Set<string>();
    const toLoad: Map<string, string>[] = [];
    log.info('Resolving theme', themeName);

    while (themePaths.length > 0) {
      const themePath = themePaths.pop()!;
      if (seen.has(themePath)) continue;
      seen.add(themePath);
      log.info('Visiting', themeName, themePath.split('extensions/')[1]);
      const loaded = this.#rawThemes.getOrInsertComputed(themePath, () => this.loadTheme(themePath, new Set(Object.keys(defaults))));
      toLoad.push(loaded.tokens);
      themePaths.push(...loaded.includes);
    }
    toLoad.push(new Map(Object.entries(defaults)));
    return toLoad;
  }

  static getTokenColor(token: string, defaults: Record<vscode.ColorThemeKind, Record<string, string>>): string | undefined {
    const themeKind = vscode.window.activeColorTheme.kind;
    const activeTheme = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme')!;
    const list = this.#computedThemes.getOrInsertComputed(activeTheme, () => this.resolveTheme(activeTheme, defaults[themeKind]));
    return list.reduce((a, map) => a ?? map.get(token), undefined! as string);
  }
}
