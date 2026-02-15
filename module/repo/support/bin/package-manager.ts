import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';

import { JSONUtil, type ExecutionResult, Runtime } from '@travetto/runtime';
import { type IndexedModule, type Package, PackageUtil } from '@travetto/manifest';
import { CliModuleUtil } from '@travetto/cli';

export type SemverLevel = 'minor' | 'patch' | 'major' | 'prerelease' | 'premajor' | 'preminor' | 'prepatch';

/**
 * Utilities for working with package managers
 */
export class PackageManager {

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
  static validatePublishedResult(result: ExecutionResult<string>): boolean {
    if (!result.valid && !result.stderr.includes('E404')) {
      throw new Error(result.stderr);
    }

    const parsed = JSONUtil.fromUTF8<{ data: { dist?: { integrity?: string } } }>(result.stdout || '{}');
    return parsed.data?.dist?.integrity !== undefined;
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
  static publish(module: IndexedModule, dryRun: boolean | undefined): ChildProcess {
    if (dryRun) {
      return this.dryRunPackaging(module);
    }

    const versionTag = module.version.match(/^.*-(rc|alpha|beta|next)[.]\d+/)?.[1] ?? 'latest';
    let args: string[];
    switch (Runtime.workspace.manager) {
      case 'npm':
      case 'yarn':
      case 'pnpm': args = ['publish', '--tag', versionTag, '--access', 'public']; break;
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