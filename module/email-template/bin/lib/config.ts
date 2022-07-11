import * as path from 'path';
import * as fs from 'fs/promises';

import { FsUtil, PathUtil } from '@travetto/boot';
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

/**
 * Configuration utils
 */
export class ConfigUtil {

  static #configFile = PathUtil.resolveUnix('resources/email/dev.yml');
  static #defaultConfig = fs.readFile(PathUtil.resolveUnix(__dirname, 'default-dev.yml'), 'utf8');

  /**
   *
   */
  static async get(): Promise<ConfigType> {
    return fs.readFile(this.#configFile, 'utf8')
      .then((f: string) => YamlUtil.parse(f) as ConfigType)
      .catch(() => ({} as ConfigType));
  }

  static async getContext() {
    const conf = await this.get();
    return conf.context ?? {};
  }

  static async getSenderConfig() {
    const conf = await this.get();
    return conf.sender ?? {};
  }

  static getDefaultConfig() {
    return this.#defaultConfig;
  }

  static async ensureConfig() {
    const file = this.#configFile;
    if (!(await FsUtil.exists(file))) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, await this.#defaultConfig, { encoding: 'utf8' });
    }
    return file;
  }
}