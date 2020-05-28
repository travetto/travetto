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
   * Additional locations for the application search paths
   */
  readonly roots: string[];

  /**
   * List of all resource roots
   */
  readonly resourceRoots: string[];

  constructor(pkgLoc: string) {
    try {
      const { version, name, license, author, description } = require(pkgLoc);
      Object.assign(this, { version, name, license, author, description });
    } catch { }


    this.travetto = require('../package.json').version; // Travetto version
    this.env = EnvUtil.getEnv();
    this.profiles = ['application', ...EnvUtil.getList('TRV_PROFILES'), this.env];

    this.profileSet = new Set(this.profiles);

    this.roots = [FsUtil.cwd, ...EnvUtil.getList('TRV_ROOTS')]
      .filter(x => !!x)
      .map(x => FsUtil.resolveUnix(FsUtil.cwd, x).replace(FsUtil.cwd, '.'))
      .filter((x, i, all) => i === 0 || x !== all[i - 1]); // De-dupe

    this.resourceRoots = [
      ...this.roots,
      ...EnvUtil.getList('TRV_RESOURCE_ROOTS')
    ];
  }

  /**
   * Generate to JSON
   */
  toJSON() {
    return ([
      'travetto', 'name', 'version', 'license', 'description',
      'author', 'env', 'profiles', 'roots', 'resourceRoots'
    ] as const)
      .reduce((acc, k) => {
        acc[k] = this[k];
        return acc;
      }, {} as Record<string, any>);
  }

  /**
   * Will return true if a profile is active
   */
  hasProfile(name: string) {
    return this.profileSet.has(name);
  }
}

export const AppManifest = new $AppManifest(FsUtil.joinUnix(FsUtil.cwd, 'package.json'));