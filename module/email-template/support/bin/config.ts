import fs from 'fs/promises';

import { path } from '@travetto/manifest';
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

  #configFile = path.resolve('resources/email/dev.yml');
  #defaultConfig = {
    sender: {
      port: 587,
      host: 'smtp.host.email',
      auth: {
        user: 'email@blah.com',
        pass: 'password'
      },
      from: 'from-email@gmail.com',
      to: 'my-email@gmail.com',
      context: {
        key: 'value'
      }
    }
  };

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

  getDefaultConfig(): string {
    return YamlUtil.serialize(this.#defaultConfig);
  }

  async ensureConfig(): Promise<string> {
    const file = this.#configFile;
    if (!(await fs.stat(file).catch(() => { }))) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, this.getDefaultConfig(), { encoding: 'utf8' });
    }
    return file;
  }
}

export const EditorConfig = new $EditorConfig();