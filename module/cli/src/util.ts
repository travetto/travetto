import { path, RootIndex } from '@travetto/manifest';

export class CliUtil {
  /**
   * Are we running from a mono-root?
   */
  static get monoRoot(): boolean {
    return !!RootIndex.manifest.monoRepo && path.cwd() === RootIndex.manifest.workspacePath;
  }

  /**
   * Get a simplified version of a module name
   * @returns
   */
  static getSimpleModuleName(name = RootIndex.mainPackage.name): string {
    return name.replace(/[\/]/, '_').replace(/@/, '');
  }
}