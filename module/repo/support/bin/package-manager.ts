import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';

import { JSONUtil, type ExecutionResult, Runtime, ExecUtil, RuntimeError, CodecUtil } from '@travetto/runtime';
import { type IndexedModule, type Package, PackageUtil } from '@travetto/manifest';
import { CliModuleUtil } from '@travetto/cli';
import { TerminalUtil } from '@travetto/terminal';

export type SemverLevel = 'minor' | 'patch' | 'major' | 'prerelease' | 'premajor' | 'preminor' | 'prepatch';

/**
 * Utilities for working with package managers
 */
export class PackageManager {

  /**
   * Check if npm login is needed
   */
  static async needsLogin(): Promise<boolean> {
    try {
      const result = await ExecUtil.getResult(spawn('npm', ['whoami']), { catch: true });
      return !result.valid;
    } catch {
      // Ignore errors checking for login profile
    }
    return false;
  }

  /**
   * Check if OTP is needed for publishing
   */
  static async needsOtp(): Promise<boolean> {
    try {
      const result = await ExecUtil.getResult(spawn('npm', ['profile', 'get', '--json']), { catch: true });
      if (result.valid) {
        const info = JSONUtil.fromUTF8<{ tfa?: { mode?: string } }>(result.stdout);
        return !!info?.tfa?.mode;
      }
    } catch {
      // Ignore errors checking for OTP profile
    }
    return false;
  }

  /**
   * Request an OTP token if required
   */
  static async requestOtp(): Promise<string | undefined> {
    let otp: string | undefined;
    if (TerminalUtil.isInteractive()) {
      console.log([
        'OTP token is required for publishing. Please provide an OTP token to proceed with publishing.',
        'This value will not be stored, and is only used for the current publish operation.'
      ].join(' '));
      otp = await TerminalUtil.prompt('Enter OTP token: ');
    }
    if (!otp) {
      throw new RuntimeError('OTP token is required for publishing, but was not provided.');
    }
    return otp;
  }

  /**
   * Classify publish error from execution result
   */
  static classifyPublishError(result: ExecutionResult): string {
    const errorText = CodecUtil.toUTF8String(result.stderr || result.stdout || '').trim();

    if (/EOTP|one-time password|two-factor|OTP/i.test(errorText)) {
      return 'Two-factor authentication (OTP) failed or was missing.';
    }
    if (/EPUBLISHCONFLICT|E403.*previously published|cannot publish over/i.test(errorText)) {
      return 'Version conflict: This version has already been published to the registry.';
    }
    if (/ENEEDAUTH|E401|login|unauthorized/i.test(errorText)) {
      return 'Authentication failed: Please log in or check your registry credentials.';
    }
    if (/E403|permission|not allowed/i.test(errorText)) {
      return 'Permission denied: You do not have access to publish this package.';
    }

    return errorText || 'Unknown publishing error.';
  }

  /**
   * Is a module already published
   */
  static isPublished(module: IndexedModule): ChildProcess {
    let args: string[];
    switch (Runtime.workspace.manager) {
      case 'npm':
      case 'yarn':
      case 'pnpm': args = ['info', `${module.name}@${module.version}`, '--json']; break;
    }
    return spawn(Runtime.workspace.manager, args, { cwd: module.sourceFolder });
  }

  /**
   * Validate published result
   */
  static validatePublishedResult(result: ExecutionResult): boolean {
    const stderr = CodecUtil.toUTF8String(result.stderr || '').trim();
    if (!result.valid && !stderr.includes('E404')) {
      throw new Error(stderr);
    }

    const stdout = CodecUtil.toUTF8String(result.stdout || '').trim();
    type PackageInfo = { dist?: { integrity?: string } };
    let parsed = JSONUtil.fromUTF8<PackageInfo | { data: PackageInfo }>(stdout || '{}');
    if ('data' in parsed) { // Yarn support
      parsed = parsed.data;
    }
    return parsed.dist?.integrity !== undefined;
  }

  /**
   * Setting the version
   */
  static version(modules: IndexedModule[], level: SemverLevel, preid?: string): ChildProcess {
    const moduleArgs = modules.flatMap(module => ['-w', module.sourceFolder]);
    let args: string[];
    switch (Runtime.workspace.manager) {
      case 'npm':
      case 'yarn':
      case 'pnpm': args = ['version', '--no-workspaces-update', level, ...(preid ? ['--preid', preid] : [])]; break;
    }
    return spawn(Runtime.workspace.manager, [...args, ...moduleArgs], { cwd: Runtime.workspace.path, stdio: 'inherit' });
  }

  /**
   * Dry-run packaging
   */
  static dryRunPackaging(module: IndexedModule): ChildProcess {
    let args: string[];
    switch (Runtime.workspace.manager) {
      case 'npm':
      case 'yarn':
      case 'pnpm': args = ['pack', '--dry-run']; break;
    }
    return spawn(Runtime.workspace.manager, args, { cwd: module.sourcePath });
  }

  /**
   * Publish a module
   */
  static publish(module: IndexedModule, dryRun: boolean | undefined, otp?: string): ChildProcess {
    if (dryRun) {
      return this.dryRunPackaging(module);
    }

    const versionTag = module.version.match(/^.*-(rc|alpha|beta|next)[.]\d+/)?.[1] ?? 'latest';
    let args: string[];
    switch (Runtime.workspace.manager) {
      case 'npm':
      case 'yarn':
      case 'pnpm': args = ['publish', '--tag', versionTag, '--access', 'public', ...(otp ? ['--otp', otp] : [])]; break;
    }
    return spawn(Runtime.workspace.manager, args, { cwd: module.sourcePath });
  }

  /**
   * Write package
   */
  static async writePackageIfChanged(modulePath: string, pkg: Package): Promise<void> {
    const final = JSONUtil.toUTF8Pretty(pkg);
    const target = path.resolve(modulePath, 'package.json');
    const current = (await fs.readFile(target, 'utf8').catch(() => '')).trim();
    if (final !== current) {
      await fs.writeFile(target, `${final}\n`, 'utf8');
    }
  }

  /**
   * Synchronize all workspace modules to have the correct versions from the current packages
   */
  static async synchronizeVersions(): Promise<Record<string, string>> {
    const versions: Record<string, string> = {};
    const folders = (await CliModuleUtil.findModules('workspace')).map(module => module.sourcePath);
    const packages = folders.map(folder => {
      const pkg = PackageUtil.readPackage(folder, true);
      versions[pkg.name] = `^${pkg.version}`;
      return { folder, pkg };
    });

    for (const { pkg } of packages) {
      for (const group of [
        pkg.dependencies ?? {},
        pkg.devDependencies ?? {},
        pkg.optionalDependencies ?? {},
        pkg.peerDependencies ?? {}
      ]) {
        for (const [module, ver] of Object.entries(versions)) {
          if (module in group && !/^[*]|(file:.*)$/.test(group[module])) {
            group[module] = ver;
          }
        }
      }
    }

    for (const { folder, pkg } of packages) {
      await this.writePackageIfChanged(folder, pkg);
    }

    return versions;
  }
}