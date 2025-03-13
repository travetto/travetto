import { CliCommandShape, CliCommand } from '@travetto/cli';
import { PackageManager } from './bin/package-manager.ts';

/**
 * Enforces all packages to write out their versions and dependencies
 */
@CliCommand()
export class VersionSyncCommand implements CliCommandShape {
  async main(): Promise<void> {
    await PackageManager.synchronizeVersions();
  }
}