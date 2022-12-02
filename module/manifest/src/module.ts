import fs from 'fs/promises';
import { statSync } from 'fs';

import { path } from './path';
import { Dependency, PackageUtil } from './package';
import {
  ManifestContext,
  ManifestModule, ManifestModuleFile, ManifestModuleFileType,
  ManifestModuleFolderType, ManifestProfile, PACKAGE_STD_PROFILE
} from './types';

const EXT_MAPPING: Record<string, ManifestModuleFileType> = {
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.json': 'json',
  '.ts': 'ts',
  '.md': 'md'
};

export class ManifestModuleUtil {

  static #getNewest(stat: { mtimeMs: number, ctimeMs: number }): number {
    return Math.max(stat.mtimeMs, stat.ctimeMs);
  }

  /**
   * Get file type for a file name
   */
  static getFileType(moduleFile: string): ManifestModuleFileType {
    if (moduleFile === 'package.json') {
      return 'package-json';
    } else if (moduleFile.startsWith('support/fixtures/') || moduleFile.startsWith('test/fixtures/') || moduleFile.startsWith('support/resources/')) {
      return 'fixture';
    } else if (moduleFile.endsWith('.d.ts')) {
      return 'typings';
    } else {
      const ext = path.extname(moduleFile);
      return EXT_MAPPING[ext] ?? 'unknown';
    }
  }

  /**
   * Get file type for a file name
   */
  static getFileProfile(moduleFile: string): ManifestProfile | undefined {
    if (moduleFile.startsWith('support/transform')) {
      return 'compile';
    } else if (moduleFile.startsWith('support/test/') || moduleFile.startsWith('test/')) {
      return 'test';
    } else {
      return;
    }
  }

  /**
   * Get folder key
   */
  static getFolderKey(moduleFile: string): ManifestModuleFolderType {
    const folderLocation = moduleFile.indexOf('/');
    if (folderLocation > 0) {
      if (moduleFile.startsWith('test/fixtures/')) {
        return 'test/fixtures';
      } else if (moduleFile.startsWith('support/fixtures/')) {
        return 'support/fixtures';
      } else if (moduleFile.startsWith('support/resources/')) {
        return 'support/resources';
      }
      const key = moduleFile.substring(0, folderLocation);
      switch (key) {
        case 'src':
        case 'bin':
        case 'test':
        case 'resources':
        case 'support': return key;
        default: return '$other';
      }
    } else if (moduleFile === 'index.ts' || moduleFile === 'index.js') {
      return '$index';
    } else if (moduleFile === 'package.json') {
      return '$package';
    } else {
      return '$root';
    }
  }

  /**
   * Simple file scanning
   */
  static async #scanFolder(folder: string, includeTopFolders = new Set<string>()): Promise<string[]> {
    const out: string[] = [];
    if (!fs.stat(folder).catch(() => false)) {
      return out;
    }
    const stack: [string, number][] = [[folder, 0]];
    while (stack.length) {
      const popped = stack.pop();
      if (!popped) {
        continue;
      }

      const [top, depth] = popped;

      // Don't navigate into sub-folders with package.json's
      if (top !== folder && await fs.stat(`${top}/package.json`).catch(() => false)) {
        continue;
      }

      for (const sub of await fs.readdir(top)) {
        const stat = await fs.stat(`${top}/${sub}`);
        if (stat.isFile()) {
          if (!sub.startsWith('.')) {
            out.push(`${top}/${sub}`);
          }
        } else {
          if (!sub.includes('node_modules') && !sub.startsWith('.') && (depth > 0 || !includeTopFolders.size || includeTopFolders.has(sub))) {
            stack.push([`${top}/${sub}`, depth + 1]);
          }
        }
      }
    }
    return out;
  }

  /**
   * Convert file (by ext) to a known file type and also retrieve its latest timestamp
   */
  static async #transformFile(moduleFile: string, full: string): Promise<ManifestModuleFile> {
    const res: ManifestModuleFile = [moduleFile, this.getFileType(moduleFile), this.#getNewest(await fs.stat(full))];
    const profile = this.getFileProfile(moduleFile);
    return profile ? [...res, profile] : res;
  }

  /**
   * Visit a module and describe files, and metadata
   */
  static async #describeModule(rootFolder: string, { name, version, folder, profiles }: Dependency): Promise<ManifestModule> {
    const main = folder === rootFolder;
    const local = (!folder.includes('node_modules') && !name.startsWith('@travetto')) || main;

    const files: ManifestModule['files'] = {};
    const folderSet = !main ? new Set(['src', 'bin', 'support']) : new Set<string>();

    for (const file of await this.#scanFolder(folder, folderSet)) {
      // Group by top folder
      const moduleFile = file.replace(`${folder}/`, '');
      const entry = await this.#transformFile(moduleFile, file);
      const key = this.getFolderKey(moduleFile);
      (files[key] ??= []).push(entry);
    }

    // Refine non-main module
    if (!main) {
      files.$root = files.$root?.filter(([file, type]) => type !== 'ts');
    }

    return {
      profiles: profiles?.includes(PACKAGE_STD_PROFILE) ? [PACKAGE_STD_PROFILE] : [...new Set(profiles)],
      name,
      version,
      main,
      local,
      source: folder,
      output: `node_modules/${name}`,
      files
    };
  }

  /**
   * Get global dependencies from package.json/travettoRepo/global
   * @param declared
   * @returns
   */
  static async collectGlobalDependencies(workspace: string, seen: Map<string, Dependency>): Promise<Dependency[]> {
    const pkg = PackageUtil.readPackage(workspace);
    const mods = pkg.travettoRepo?.globalModules ?? [];
    const out: Dependency[] = [];
    for (const modFolder of mods) {
      const resolved = path.resolve(workspace, modFolder);
      out.unshift(...(await PackageUtil.collectDependencies(resolved, [], seen)));
    }
    return out;
  }

  /**
   * Produce all modules for a given manifest folder, adding in some given modules when developing framework
   */
  static async produceModules(ctx: ManifestContext): Promise<Record<string, ManifestModule>> {
    const seen = new Map<string, Dependency>();
    const declared = await PackageUtil.collectDependencies(ctx.mainPath, [], seen);

    const allModules = [
      ...declared,
      ...(ctx.monoRepo ? await this.collectGlobalDependencies(ctx.workspacePath, seen) : [])
    ].sort((a, b) => a.name.localeCompare(b.name));

    const out: Record<string, ManifestModule> = {};
    for (const mod of allModules) {
      const cfg = await this.#describeModule(ctx.mainPath, mod);
      out[cfg.name] = cfg;
    }
    return out;
  }
}