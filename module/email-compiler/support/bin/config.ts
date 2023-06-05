import fs from 'fs/promises';

import { RootIndex, path } from '@travetto/manifest';
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

  #configFile: Record<string, string> = {};
  #defaultConfig = {
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
  async get(file: string): Promise<ConfigType> {
    try {
      const mod = RootIndex.getModuleFromSource(file)!.name;
      const content = await fs.readFile(this.#configFile[mod], 'utf8');
      return YamlUtil.parse<ConfigType>(content);
    } catch {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return {} as ConfigType;
    }
  }

  async getContext(file: string): Promise<Exclude<ConfigType['context'], undefined>> {
    const conf = await this.get(file);
    return conf.context ?? {};
  }

  async getSenderConfig(file: string): Promise<Exclude<ConfigType['sender'], undefined>> {
    const conf = await this.get(file);
    return conf.sender ?? {};
  }

  getDefaultConfig(): string {
    return YamlUtil.serialize(this.#defaultConfig);
  }

  async ensureConfig(file: string): Promise<string> {
    console.log('Ensuring config', file);
    const mod = RootIndex.getModuleFromSource(file)!;
    const resolved = this.#configFile[mod.name] ??= path.resolve(mod.sourcePath, 'resources/email/dev.yml');
    if (!(await fs.stat(resolved).catch(() => { }))) {
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, this.getDefaultConfig(), { encoding: 'utf8' });
    }
    return resolved;
  }
}

export const EditorConfig = new $EditorConfig();