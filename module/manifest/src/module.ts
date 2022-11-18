import * as fs from 'fs/promises';
import { statSync } from 'fs';

import { path } from './path';
import { Dependency, PackageUtil } from './package';
import {
  ManifestModule, ManifestModuleFile, ManifestModuleFileType,
  ManifestModuleFolders, ManifestModuleFolderType
} from './types';

const EXT_MAPPING: Record<string, ManifestModuleFileType> = {
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.json': 'json',
  '.ts': 'ts'
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
    } else if (moduleFile.includes('support/fixtures/') || moduleFile.includes('test/fixtures/') || moduleFile.includes('support/resources/')) {
      return 'fixture';
    } else if (moduleFile.endsWith('.d.ts')) {
      return 'typings';
    } else {
      const ext = path.extname(moduleFile);
      return EXT_MAPPING[ext] ?? 'unknown';
    }
  }

  /**
   * Get folder key
   */
  static getFolderKey(moduleFile: string): ManifestModuleFolderType {
    const folderLocation = moduleFile.indexOf('/');
    if (folderLocation > 0) {
      if (moduleFile.startsWith('test/fixtures')) {
        return 'test/fixtures';
      } else if (moduleFile.startsWith('support/fixtures')) {
        return 'support/fixtures';
      } else if (moduleFile.startsWith('support/resources')) {
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
          out.push(`${top}/${sub}`);
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
    return [moduleFile, this.getFileType(moduleFile), this.#getNewest(await fs.stat(full))];
  }

  /**
   * Visit a module and describe files, and metadata
   */
  static async #describeModule(rootFolder: string, { id, name, version, folder, profiles }: Dependency): Promise<ManifestModule> {
    const main = folder === rootFolder;
    const local = (!folder.includes('node_modules') && !name.startsWith('@travetto')) || main;

    const files: ManifestModuleFolders = {};
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

    // Cleaning up names
    id ??= (!local ? `@npm:${name}` : name).replace('/', ':');

    return {
      id,
      profiles: profiles?.includes('*') ? [] : [...new Set(profiles?.filter(x => x !== '*'))],
      name,
      version,
      main,
      local,
      source: folder,
      output: `node_modules/${name}`,
      files
    };
  }

  static async collectGlobalDependencies(declared: Dependency[]): Promise<Dependency[]> {
    if (!process.env.TRV_GLOBAL_MODS) {
      return [];
    }

    const mods = process.env.TRV_GLOBAL_MODS!.split(',').map(x => x.split(':'));
    const out: Dependency[] = [];
    for (const [dep, profile] of mods) {
      if (!declared.some(x => x.name === dep)) {
        const folder = dep.replace('@travetto', process.env.TRV_GLOBAL_ROOT!);
        out.unshift(...(await PackageUtil.collectDependencies(folder, [profile || '*'])));
      }
    }
    return out;
  }

  /**
   * Produce all modules for a given manifest folder, adding in some given modules when developing framework
   */
  static async produceModules(rootFolder: string): Promise<Record<string, ManifestModule>> {
    const declared = await PackageUtil.collectDependencies(rootFolder, ['*']);

    const allModules = [
      ...declared,
      ...(await this.collectGlobalDependencies(declared))
    ].sort((a, b) => a.name.localeCompare(b.name));

    const out: Record<string, ManifestModule> = {};
    for (const mod of allModules) {
      const cfg = await this.#describeModule(rootFolder, mod);
      out[cfg.name] = cfg;
    }
    return out;
  }

  /**
   * Update manifest module file
   */
  static updateModuleFile(module: ManifestModule, moduleFile: string, action: 'create' | 'delete' | 'update'): void {
    const fileKey = this.getFolderKey(moduleFile);
    const sourceFile = `${module.source}/${moduleFile}`;
    const idx = module.files[fileKey]?.findIndex(([f]) => f === moduleFile);

    switch (action) {
      case 'create': {
        (module.files[fileKey] ??= []).push([moduleFile, this.getFileType(moduleFile), this.#getNewest(statSync(sourceFile))]);
        break;
      }
      case 'delete': {
        if (idx !== undefined && idx >= 0) {
          module.files[fileKey]!.splice(idx, 1);
        }
        break;
      }
      case 'update': {
        if (idx !== undefined && idx >= 0) {
          module.files[fileKey]![idx][2] = this.#getNewest(statSync(sourceFile));
        }
        break;
      }
    }
  }
}