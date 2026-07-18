import { CliCommand, type CliCommandShape } from '@travetto/cli';

import { PackageManager } from './bin/package-manager.ts';

/**
 * Synchronize package versions and dependency ranges across the monorepo.
 *
 * Ensures package metadata reflects workspace version policy before publishing
 * or release operations.
 */
@CliCommand()
export class VersionSyncCommand implements CliCommandShape {
  async main(): Promise<void> {
    await PackageManager.synchronizeVersions();
  }
}
