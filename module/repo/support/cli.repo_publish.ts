import { CliCommand, type CliCommandShape, cliTpl } from '@travetto/cli';
import { RuntimeError } from '@travetto/runtime';

import { RepoExecUtil } from './bin/exec.ts';
import { PackageManager } from './bin/package-manager.ts';

/**
 * Publish unpublished workspace modules to the package registry.
 *
 * The command performs a publishability scan first, then publishes candidates.
 * Dry-run mode is enabled by default.
 */
@CliCommand()
export class RepoPublishCommand implements CliCommandShape {
  /** Dry Run? */
  dryRun = true;

  /** OTP Token */
  otp?: string;

  async main(): Promise<void> {
    const published = await RepoExecUtil.execOnModules('workspace', module => PackageManager.isPublished(module), {
      filter: module => !!module.workspace && !module.internal,
      progressMessage: module => `Checking published [%completed/%total] -- ${module?.name ?? ''}`,
      showStderr: false,
      showProgressList: true,
      isSuccess: () => true
    });

    const unpublished = [...published.entries()]
      .filter(([, result]) => !PackageManager.validatePublishedResult(result))
      .map(([module]) => module);

    if (this.dryRun) {
      console.log(
        'Unpublished modules',
        unpublished.map(module => module.sourceFolder)
      );
    }

    let otp = this.otp;
    if (unpublished.length > 0 && !this.dryRun) {
      if (await PackageManager.needsLogin()) {
        throw new RuntimeError('NPM login is required to publish. Please run "npm login" to authenticate.');
      }
      if (!otp && (await PackageManager.needsOtp())) {
        otp = await PackageManager.requestOtp();
      }
      if (!otp) {
        throw new RuntimeError('OTP token is required for publishing, but was not provided.');
      }
    }

    const unpublishedSet = new Set(unpublished);

    const results = await RepoExecUtil.execOnModules('workspace', module => PackageManager.publish(module, this.dryRun, otp), {
      progressMessage: module => `Publishing [%completed/%total] -- ${module?.name ?? ''} (Failed %failed)`,
      showStdout: false,
      showStderr: false,
      showProgressList: true,
      filter: module => unpublishedSet.has(module)
    });

    const failures = [...results.entries()].filter(([, result]) => !result.valid);
    if (failures.length > 0) {
      console.error(cliTpl`\n${{ title: 'Failed to publish the following modules:' }}`);
      console.error(cliTpl`${'-'.repeat(50)}`);
      const nameWidth = Math.max(...failures.map(([module]) => module.name.length));
      for (const [module, result] of failures) {
        console.error(
          cliTpl`${{ identifier: module.name.padStart(nameWidth, ' ') }}: ${{ description: PackageManager.classifyPublishError(result) }}`
        );
      }
      process.exitCode = 1;
    }
  }
}
