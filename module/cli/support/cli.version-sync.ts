import { CliCommand, CliModuleUtil } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

/**
 * Enforces all packages to write out their versions and dependencies
 */
export class VersionSyncCommand extends CliCommand {
  name = 'version-sync';

  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  async action(): Promise<void> {
    await CliModuleUtil.synchronizeModuleVersions();
  }
}