import * as path from 'path';
import * as fs from 'fs/promises';

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
export class $EditorConfig {

  #configFile = path.resolve('resources/email/dev.yml').__posix;
  #defaultConfig = fs.readFile(path.resolve(__source.folder, 'default-dev.yml').__posix, 'utf8');

  /**
   *
   */
  async get(): Promise<ConfigType> {
    try {
      const content = await fs.readFile(this.#configFile, 'utf8');
      return YamlUtil.parse<ConfigType>(content);
    } catch {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return {} as ConfigType;
    }
  }

  async getContext(): Promise<Exclude<ConfigType['context'], undefined>> {
    const conf = await this.get();
    return conf.context ?? {};
  }

  async getSenderConfig(): Promise<Exclude<ConfigType['sender'], undefined>> {
    const conf = await this.get();
    return conf.sender ?? {};
  }

  getDefaultConfig(): Promise<string> {
    return this.#defaultConfig;
  }

  async ensureConfig(): Promise<string> {
    const file = this.#configFile;
    if (!(await fs.stat(file).catch(() => { }))) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, await this.#defaultConfig, { encoding: 'utf8' });
    }
    return file;
  }
}

export const EditorConfig = new $EditorConfig();