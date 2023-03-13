import { CliCommandShape, CliCommand, CliModuleUtil } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

/**
 * Enforces all packages to write out their versions and dependencies
 */
@CliCommand()
export class VersionSyncCommand implements CliCommandShape {
  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  async main(): Promise<void> {
    await CliModuleUtil.synchronizeModuleVersions();
  }
}