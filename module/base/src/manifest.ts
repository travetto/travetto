import { FsUtil, EnvUtil } from '@travetto/boot';

/**
 * General purpose information about the application.  Derived from the app's package.json
 */
class $AppManifest {
  /**
   * App profiles with indexing
   */
  readonly #profileSet: Set<string>;

  /**
   * Env
   */
  readonly env: string;

  /**
   * Are we in production
   */
  readonly prod: boolean;

  /**
   * Travetto Version
   */
  readonly travetto: string;

  /**
   * App Version
   */
  readonly version: string;

  /**
   * App Name
   */
  readonly name = 'untitled';

  /**
   * App License
   */
  readonly license?: string;

  /**
   * App description
   */
  readonly description = 'A Travetto application';

  /**
   * App author
   */
  readonly author?: { email: string, name: string };

  /**
   * List of active profiles
   */
  readonly profiles: string[];

  /**
   * List of all resource roots
   */
  readonly resourceFolders: string[];

  /**
   * List of common source folders
   */
  readonly commonSourceFolders: string[];

  /**
   * List of local source folders
   */
  readonly localSourceFolders: string[];

  /**
   * List of modules to not traverse into
   */
  readonly commonSourceExcludeModules: Set<string>;

  /**
   * Amount of time to wait at shutdown
   */
  readonly shutdownWait: number;

  /**
   * Debug state
   */
  readonly debug: {
    status?: boolean;
    value?: string;
  };

  constructor(pkgLoc: string) {
    try {
      const { version, name, license, author, description } = require(pkgLoc);
      Object.assign(this, { version, name, license, author, description });
    } catch { }
    this.travetto = require('../package.json').version; // Travetto version

    this.env = EnvUtil.get('TRV_ENV', EnvUtil.get('NODE_ENV', 'dev'))
      .replace(/^production$/i, 'prod')
      .replace(/^development$/i, 'dev')
      .toLowerCase();
    this.prod = this.env === 'prod';
    this.profiles = ['application', ...EnvUtil.getList('TRV_PROFILES'), this.env];
    this.#profileSet = new Set(this.profiles);

    // Compute the debug state
    const status = EnvUtil.isSet('TRV_DEBUG') ? !EnvUtil.isFalse('TRV_DEBUG') : !this.prod;
    this.debug = {
      status,
      value: (status ? EnvUtil.get('TRV_DEBUG') : '') || undefined
    };

    this.commonSourceFolders = ['src', ...EnvUtil.getList('TRV_SRC_COMMON')];
    this.localSourceFolders = [...EnvUtil.getList('TRV_SRC_LOCAL')];
    this.resourceFolders = ['resources', ...EnvUtil.getList('TRV_RESOURCES')];

    this.commonSourceExcludeModules = new Set([
      // This drives the init process, so cannot happen in a support file
      '@travetto/cli', '@travetto/boot', '@travetto/doc'
    ]);
    this.shutdownWait = EnvUtil.getTime('TRV_SHUTDOWN_WAIT', 2, 's');
  }

  /**
   * Generate to JSON
   */
  toJSON() {
    const out: Record<string, unknown> = {
      ...this as Record<string, unknown>,
      dynamicModules: EnvUtil.getDynamicModules(),
      watch: EnvUtil.isWatch(),
      readonly: EnvUtil.isReadonly()
    };
    return out;
  }

  /**
   * Will return true if a profile is active
   */
  hasProfile(name: string) {
    return this.#profileSet.has(name);
  }
}

export const AppManifest = new $AppManifest(FsUtil.resolveUnix('package.json'));