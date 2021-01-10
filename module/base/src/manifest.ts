import { FsUtil, EnvUtil } from '@travetto/boot';
/**
 * General purpose information about the application.  Derived from the app's package.json
 */
class $AppManifest {
  /**
   * Env
   */
  private readonly env: string;

  /**
   * App profiles with indexing
   */
  private readonly profileSet: Set<string>;

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
    this.env = EnvUtil.getEnv();
    this.profiles = ['application', ...EnvUtil.getList('TRV_PROFILES'), this.env];

    this.profileSet = new Set(this.profiles);

    this.commonSourceFolders = ['src', ...EnvUtil.getList('TRV_SRC_COMMON')];
    this.commonSourceExcludeModules = new Set([
      // This drives the init process, so cannot happen in a support file
      ...EnvUtil.getList('TRV_SRC_COMMON_EXCLUDE'),
      '@travetto/cli', '@travetto/boot', '@travetto/doc'
    ]);

    this.localSourceFolders = [...EnvUtil.getList('TRV_SRC_LOCAL')];
    this.resourceFolders = ['resources', ...EnvUtil.getList('TRV_RESOURCES')];

    // Compute the debug state
    const status = EnvUtil.isSet('TRV_DEBUG') ? !EnvUtil.isFalse('TRV_DEBUG') : !EnvUtil.isProd();
    this.debug = {
      status,
      value: (status ? EnvUtil.get('TRV_DEBUG') : '') || undefined
    };
  }

  /**
   * Generate to JSON
   */
  toJSON() {
    return ([
      'travetto', 'name', 'version', 'license', 'description',
      'author', 'env', 'profiles', 'localSourceFolders',
      'commonSourceFolders', 'resourceFolders', 'debug'
    ] as const)
      .reduce((acc, k) => {
        acc[k] = this[k];
        return acc;
      }, {
        watch: EnvUtil.isWatch(),
        readonly: EnvUtil.isReadonly()
      } as Record<string, any>);
  }

  /**
   * Will return true if a profile is active
   */
  hasProfile(name: string) {
    return this.profileSet.has(name);
  }
}

export const AppManifest = new $AppManifest(FsUtil.resolveUnix('package.json'));