import path from 'node:path';
import fs from 'node:fs/promises';

import { ExecUtil, ExecutionOptions, ExecutionState, ExecutionResult, Spawn } from '@travetto/base';
import { IndexedModule, ManifestContext, Package, PackageUtil } from '@travetto/manifest';
import { CliModuleUtil } from '@travetto/cli';

export type SemverLevel = 'minor' | 'patch' | 'major' | 'prerelease' | 'premajor' | 'preminor' | 'prepatch';

/**
 * Utilities for working with package managers
 */
export class PackageManager {

  /**
   * Is a module already published
   */
  static isPublished(ctx: ManifestContext, mod: IndexedModule, opts: ExecutionOptions): ExecutionState {
    let args: string[];
    switch (ctx.workspace.manager) {
      case 'npm':
        args = ['show', `${mod.name}@${mod.version}`, 'version', '--json'];
        break;
      case 'yarn':
        args = ['info', `${mod.name}@${mod.version}`, 'dist.integrity', '--json'];
        break;
    }
    return ExecUtil.spawn(ctx.workspace.manager, args, opts);
  }

  /**
   * Validate published result
   */
  static validatePublishedResult(ctx: ManifestContext, mod: IndexedModule, result: ExecutionResult): boolean {
    switch (ctx.workspace.manager) {
      case 'npm': {
        if (!result.valid && !result.stderr.includes('E404')) {
          throw new Error(result.stderr);
        }
        const item: (string[] | string) = result.stdout ? JSON.parse(result.stdout) : [];
        const found = Array.isArray(item) ? item.pop() : item;
        return !!found && found === mod.version;
      }
      case 'yarn': {
        const res = JSON.parse(result.stdout);
        return res.data !== undefined;
      }
    }
  }

  /**
   * Setting the version
   */
  static async version(ctx: ManifestContext, modules: IndexedModule[], level: SemverLevel, preid?: string): Promise<void> {
    const mods = modules.flatMap(m => ['-w', m.sourceFolder]);
    let args: string[];
    switch (ctx.workspace.manager) {
      case 'npm':
      case 'yarn':
        args = ['version', '--no-workspaces-update', level, ...(preid ? ['--preid', preid] : []), ...mods];
        break;
    }
    await Spawn.exec(ctx.workspace.manager, args, { stdio: 'inherit' }).success;
  }

  /**
   * Dry-run packaging
   */
  static dryRunPackaging(ctx: ManifestContext, opts: ExecutionOptions): ExecutionState {
    let args: string[];
    switch (ctx.workspace.manager) {
      case 'npm':
      case 'yarn':
        args = ['pack', '--dry-run'];
        break;
    }
    return ExecUtil.spawn(ctx.workspace.manager, args, opts);
  }

  /**
   * Publish a module
   */
  static publish(ctx: ManifestContext, mod: IndexedModule, dryRun: boolean | undefined, opts: ExecutionOptions): ExecutionState {
    if (dryRun) {
      return this.dryRunPackaging(ctx, opts);
    }

    const versionTag = mod.version.match(/^.*-(rc|alpha|beta|next)[.]\d+/)?.[1] ?? 'latest';
    let args: string[];
    switch (ctx.workspace.manager) {
      case 'npm':
      case 'yarn':
        args = ['publish', '--tag', versionTag, '--access', 'public'];
        break;
    }
    return ExecUtil.spawn(ctx.workspace.manager, args, opts);
  }

  /**
   * Write package
   */
  static async writePackageIfChanged(modulePath: string, pkg: Package): Promise<void> {
    const final = JSON.stringify(pkg, null, 2);
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
    const folders = (await CliModuleUtil.findModules('all')).map(x => x.sourcePath);
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
        for (const [mod, ver] of Object.entries(versions)) {
          if (mod in group && !/^[*]|(file:.*)$/.test(group[mod])) {
            group[mod] = ver;
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