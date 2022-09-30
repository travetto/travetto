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
      .then((f: string) => YamlUtil.parse<ConfigType>(f))
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .catch(() => ({} as ConfigType));
  }

  static async getContext(): Promise<Exclude<ConfigType['context'], undefined>> {
    const conf = await this.get();
    return conf.context ?? {};
  }

  static async getSenderConfig(): Promise<Exclude<ConfigType['sender'], undefined>> {
    const conf = await this.get();
    return conf.sender ?? {};
  }

  static getDefaultConfig(): Promise<string> {
    return this.#defaultConfig;
  }

  static async ensureConfig(): Promise<string> {
    const file = this.#configFile;
    if (!(await FsUtil.exists(file))) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, await this.#defaultConfig, { encoding: 'utf8' });
    }
    return file;
  }
}