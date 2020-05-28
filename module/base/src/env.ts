import { EnvUtil, FsUtil } from '@travetto/boot';

/**
 * General Environmental state for the application
 */
class $Env {

  private profiles: Set<string>;

  /**
   * The application env.  Generally 'prod', 'dev', or 'test'
   */
  readonly env: string;

  /**
   * Additional locations for the application search paths
   */
  readonly appRoots: string[];

  constructor() {
    this.env = EnvUtil.get('TRV_ENV', EnvUtil.get('NODE_ENV', 'dev'))
      .replace(/^production$/i, 'prod')
      .replace(/^development$/i, 'dev')
      .toLowerCase();

    this.profiles = new Set(EnvUtil.getList('TRV_PROFILES'));
    this.appRoots = this.computeAppRoots();
  }

  private computeAppRoots() {
    // Include root
    return [FsUtil.cwd, ...EnvUtil.getList('TRV_APP_ROOTS')]
      .filter(x => !!x)
      .map(x => FsUtil.resolveUnix(FsUtil.cwd, x).replace(FsUtil.cwd, '.'))
      .filter((x, i, all) => i === 0 || x !== all[i - 1]); // Dedupe
  }

  /**
   * Generate to JSON
   */
  toJSON() {
    return (['env', 'profiles', 'appRoots'] as const)
      .reduce((acc, k) => {
        acc[k] = this[k];
        return acc;
      }, {} as Record<string, any>);
  }

  /**
   * Will return true if a profile is active
   */
  hasProfile(name: string) {
    return this.profiles.has(name);
  }
}

export const Env = new $Env();