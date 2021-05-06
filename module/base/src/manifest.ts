import { AppCache, EnvUtil, Package, PathUtil } from '@travetto/boot';
import { SourceConfig } from '@travetto/boot/src/internal/source';

import { version as framework } from '../package.json';
import { TimeSpan, Util } from './util';

/**
 * Application info
 */
interface AppInfo {
  /**
   * App Version
   */
  version?: string;
  /**
   * App Name
   */
  name: string;
  /**
   * App License
   */
  license?: string;
  /**
   * App description
   */
  description?: string;
  /**
   * App author
   */
  author?: { email: string, name: string };
  /**
   * Travetto Version
   */
  framework?: string;
}

/**
 * Environment config
 */
interface EnvConfig {
  /**
   * Environment name
   */
  name: string;
  /**
   * Are we in prod
   */
  prod: boolean;
  /**
   * List of active profiles
   */
  profiles: string[];
  /**
   * Debug state
   */
  debug: {
    /**
     * Is debug active
     */
    status?: boolean;
    /**
     * What is the debug filter value
     */
    value?: string;
  };
  /**
   * Amount of time to wait at shutdown
   */
  shutdownWait: number | TimeSpan;
  /**
   * List of folders for resources
   */
  resources: string[];
}

/**
 * General purpose information about the application.  Derived from the app's package.json
 */
class $AppManifest {
  /**
   * App profiles with indexing
   */
  readonly #profileSet: Set<string>;

  /** Application info */
  readonly info: AppInfo;

  /** Env */
  readonly env: EnvConfig;

  /** Paths */
  readonly source: SourceConfig;

  constructor(pkg: Record<string, unknown> = {}) {
    const def = {
      framework,
      name: 'untitled',
      description: 'A Travetto application',
      version: '0.0.0'
    };
    this.info = { ...def };
    try {
      const { version = def.version, name = def.name, license, author, description = def.description } = pkg;
      Object.assign(this.info, { version, name, license, author, description });
    } catch { }

    const env = EnvUtil.get('TRV_ENV', EnvUtil.get('NODE_ENV', 'dev'))
      .replace(/^production$/i, 'prod')
      .replace(/^development$/i, 'dev')
      .toLowerCase();

    // Compute the debug state
    const status = EnvUtil.isSet('TRV_DEBUG') ? !EnvUtil.isFalse('TRV_DEBUG') : env !== 'prod';

    this.env = {
      name: env,
      profiles: ['application', ...EnvUtil.getList('TRV_PROFILES'), env],
      prod: env === 'prod',
      debug: {
        status,
        value: (status ? EnvUtil.get('TRV_DEBUG') : '') || undefined
      },
      resources: ['resources', ...EnvUtil.getList('TRV_RESOURCES')],
      shutdownWait: Util.getEnvTime('TRV_SHUTDOWN_WAIT', '2s')
    };

    this.#profileSet = new Set(this.env.profiles);

    this.source = {
      common: ['src', ...EnvUtil.getList('TRV_SRC_COMMON')],
      local: [...EnvUtil.getList('TRV_SRC_LOCAL')],
      excludeModules: new Set(['@travetto/cli', '@travetto/doc', '@travetto/boot'])
    };
  }

  /**
   * Generate to JSON
   */
  toJSON() {
    const out: Record<string, unknown> = this.env.prod ?
      { info: this.info } :
      {
        info: this.info,
        env: {
          ...this.env,
          cache: AppCache.cacheDir.replace(`${PathUtil.cwd}/`, ''),
          node: process.version,
          dynamic: EnvUtil.isDynamic(),
          readonly: EnvUtil.isReadonly()
        },
        source: {
          ...this.source,
          dynamicModules: EnvUtil.getDynamicModules(),
        }
      };
    return out;
  }

  /**
   * Is in prod mode
   */
  get prod() {
    return this.env.prod;
  }

  /**
   * Will return true if a profile is active
   */
  hasProfile(name: string) {
    return this.#profileSet.has(name);
  }
}

export const AppManifest = new $AppManifest(Package);