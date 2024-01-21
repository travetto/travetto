import fs from 'node:fs/promises';

import { ManifestFileUtil, RuntimeContext } from '@travetto/manifest';
import { YamlUtil } from '@travetto/yaml';

interface ConfigType {
  to: string;
  from: string;
  context?: Record<string, unknown>;
  sender?: {
    port?: number;
    host?: string;
    auth?: {
      user?: string;
      pass?: string;
    };
  };
}

const CONFIG_FILE = 'resources/email-context.yml';

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
  static async get<K extends keyof ConfigType>(key: K): Promise<Exclude<ConfigType[K], undefined>>;
  static async get(): Promise<ConfigType>;
  static async get<K extends keyof ConfigType>(key?: K): Promise<ConfigType | ConfigType[K]> {
    try {
      const resolved = RuntimeContext.workspaceRelative(CONFIG_FILE);
      const content = await fs.readFile(resolved, 'utf8');
      const data = YamlUtil.parse<ConfigType>(content);
      return key ? data[key] : data;
    } catch {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return {} as ConfigType;
    }
  }

  static getDefaultConfig(): string {
    return YamlUtil.serialize(this.DEFAULT_CONFIG);
  }

  static async ensureConfig(): Promise<string> {
    const resolved = RuntimeContext.workspaceRelative(CONFIG_FILE);
    if (!(await fs.stat(resolved).catch(() => { }))) {
      await ManifestFileUtil.bufferedFileWrite(resolved, this.getDefaultConfig());
    }
    return resolved;
  }
}