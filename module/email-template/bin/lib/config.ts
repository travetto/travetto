import * as path from 'path';
import * as fs from 'fs';

import { FsUtil } from '@travetto/boot';
import { YamlUtil } from '@travetto/yaml';

interface ConfigType {
  to?: string;
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

  static CONFIG_FILE = FsUtil.resolveUnix('resources/email/dev.yml');
  static DEFAULT_CONFIG = fs.readFileSync(FsUtil.resolveUnix(__dirname, 'default-dev.yml'));

  /**
   *
   */
  static async get(): Promise<ConfigType> {
    return fs.promises.readFile(this.CONFIG_FILE, 'utf8')
      .then(f => YamlUtil.parse(f) as ConfigType)
      .catch(err => ({} as ConfigType));
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
    return this.DEFAULT_CONFIG;
  }

  static async ensureConfig() {
    const file = this.CONFIG_FILE;
    if (!(await FsUtil.exists(file))) {
      await FsUtil.mkdirpSync(path.dirname(file));
      await fs.promises.writeFile(file, this.DEFAULT_CONFIG, { encoding: 'utf8' });
    }
    return file;
  }
}