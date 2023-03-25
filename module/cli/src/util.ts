import { RootIndex } from '@travetto/manifest';

export class CliUtil {
  /**
   * Are we running from a mono-root?
   */
  static get monoRoot(): boolean {
    return !!RootIndex.manifest.monoRepo && RootIndex.mainModule.sourcePath === RootIndex.manifest.workspacePath;
  }

  /**
   * Get a simplified version of a module name
   * @returns
   */
  static getSimpleModuleName(name = RootIndex.mainModuleName): string {
    return name.replace(/[\/]/, '_').replace(/@/, '');
  }
}