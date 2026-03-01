import fs from 'node:fs/promises';
import { parse, stringify } from 'yaml';

import { Runtime } from '@travetto/runtime';
import { ManifestFileUtil } from '@travetto/manifest';

import type { EditorConfigType } from './types.ts';

export const CONFIG_FILE = 'resources/email/local.yml';

/**
 * Configuration utils
 */
export class EditorConfig {

  static DEFAULT_CONFIG = {
    to: 'my-email@gmail.com',
    from: 'from-email@gmail.com',
    context: {
      key: 'value'
    },
    sender: {
      port: 587,
      host: 'smtp.ethereal.email',
      auth: {
        user: 'email@blah.com',
        pass: 'password'
      },
    },
  };

  /**
   *
   */
  static async get<K extends keyof EditorConfigType>(key: K): Promise<Exclude<EditorConfigType[K], undefined>>;
  static async get(): Promise<EditorConfigType>;
  static async get<K extends keyof EditorConfigType>(key?: K): Promise<EditorConfigType | EditorConfigType[K]> {
    try {
      const resolved = Runtime.workspaceRelative(CONFIG_FILE);
      const content = await fs.readFile(resolved, 'utf8');
      const data: EditorConfigType = parse(content) ?? {};
      return key ? data[key] : data;
    } catch {
      return { to: undefined!, from: undefined! };
    }
  }

  static getDefaultConfig(): string {
    return stringify(this.DEFAULT_CONFIG);
  }

  static async ensureConfig(): Promise<string> {
    const resolved = Runtime.workspaceRelative(CONFIG_FILE);
    if (!(await fs.stat(resolved).catch(() => { }))) {
      await ManifestFileUtil.bufferedFileWrite(resolved, this.getDefaultConfig());
    }
    return resolved;
  }
}