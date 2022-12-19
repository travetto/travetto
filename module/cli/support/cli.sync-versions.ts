import { CliCommand, CliModuleUtil } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

/**
 * Enforces all packages to write out their versions and dependencies
 */
export class SyncVersionsCommand extends CliCommand {
  name = 'sync-versions';

  isActive(): boolean {
    return !!RootIndex.manifest.monoRepo;
  }

  async run(): Promise<void> {
    await CliModuleUtil.synchronizeModuleVersions();
  }
}