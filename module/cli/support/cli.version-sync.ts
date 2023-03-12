import { BaseCliCommand, CliCommand, CliModuleUtil } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

/**
 * Enforces all packages to write out their versions and dependencies
 */
@CliCommand()
export class VersionSyncCommand implements BaseCliCommand {
  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  async action(): Promise<void> {
    await CliModuleUtil.synchronizeModuleVersions();
  }
}