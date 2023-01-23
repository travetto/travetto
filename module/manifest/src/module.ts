import fs from 'fs/promises';

import { path } from './path';
import {
  ManifestContext,
  ManifestModule, ManifestModuleFile, ManifestModuleFileType,
  ManifestModuleFolderType, ManifestProfile
} from './types';
import { ModuleDep, ModuleDependencyVisitor } from './dependencies';
import { PackageUtil } from './package';

const EXT_MAPPING: Record<string, ManifestModuleFileType> = {
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.json': 'json',
  '.ts': 'ts',
  '.md': 'md'
};

const INDEX_FILES = new Set([
  'index.ts',
  'index.js',
  '__index__.ts',
  '__index__.js',
  '__index.ts',
  '__index.js'
]);

export class ManifestModuleUtil {

  static #getNewest(stat: { mtimeMs: number, ctimeMs: number }): number {
    return Math.max(stat.mtimeMs, stat.ctimeMs);
  }

  /**
   * Simple file scanning
   */
  static async #scanFolder(folder: string, topFolders = new Set<string>(), topFiles = new Set<string>()): Promise<string[]> {
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
          if (!sub.startsWith('.') && (depth > 0 || !topFiles.size || topFiles.has(sub))) {
            out.push(`${top}/${sub}`);
          }
        } else {
          if (!sub.includes('node_modules') && !sub.startsWith('.') && (depth > 0 || !topFolders.size || topFolders.has(sub))) {
            stack.push([`${top}/${sub}`, depth + 1]);
          }
        }
      }
    }
    return out;
  }

  /**
   * Get file type for a file name
   */
  static getFileType(moduleFile: string): ManifestModuleFileType {
    if (moduleFile === 'package.json') {
      return 'package-json';
    } else if (
      moduleFile.startsWith('support/fixtures/') ||
      moduleFile.startsWith('test/fixtures/') ||
      moduleFile.startsWith('support/resources/')
    ) {
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
    } else if (moduleFile.startsWith('doc/') || moduleFile === 'DOC.ts') {
      return 'doc';
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
        case 'doc':
        case 'resources':
        case 'support': return key;
        default: return '$other';
      }
    } else if (moduleFile === 'DOC.ts') {
      return 'doc';
    } else if (INDEX_FILES.has(moduleFile)) {
      return '$index';
    } else if (moduleFile === 'package.json') {
      return '$package';
    } else {
      return '$root';
    }
  }

  /**
   * Convert file (by ext) to a known file type and also retrieve its latest timestamp
   */
  static async transformFile(moduleFile: string, full: string): Promise<ManifestModuleFile> {
    const res: ManifestModuleFile = [moduleFile, this.getFileType(moduleFile), this.#getNewest(await fs.stat(full))];
    const profile = this.getFileProfile(moduleFile);
    return profile ? [...res, profile] : res;
  }

  /**
   * Visit a module and describe files, and metadata
   */
  static async describeModule(dep: ModuleDep): Promise<ManifestModule> {
    const { main, mainSource, local, name, version, sourcePath, profileSet, parentSet, internal } = dep;
    const files: ManifestModule['files'] = {};
    const folderSet = new Set<ManifestModuleFolderType>(mainSource ? [] : ['src', 'bin', 'support']);
    const fileSet = new Set(mainSource ? [] : [...INDEX_FILES, 'package.json']);

    for (const file of await this.#scanFolder(sourcePath, folderSet, fileSet)) {
      // Group by top folder
      const moduleFile = file.replace(`${sourcePath}/`, '');
      const entry = await this.transformFile(moduleFile, file);
      const key = this.getFolderKey(moduleFile);
      (files[key] ??= []).push(entry);
    }

    // Refine non-main source
    if (!mainSource) {
      files.$root = files.$root?.filter(([file, type]) => type !== 'ts');
    }

    const profiles = [...profileSet].sort();
    const parents = [...parentSet].sort();
    const output = `node_modules/${name}`;

    return { main, name, version, local, internal, source: sourcePath, output, files, profiles, parents, };
  }

  /**
   * Produce all modules for a given manifest folder, adding in some given modules when developing framework
   */
  static async produceModules(ctx: ManifestContext): Promise<Record<string, ManifestModule>> {
    const visitor = new ModuleDependencyVisitor(ctx);
    const declared = await PackageUtil.visitPackages(ctx.mainPath, visitor);
    const sorted = [...declared].sort((a, b) => a.name.localeCompare(b.name));

    const modules = await Promise.all(sorted.map(x => this.describeModule(x)));
    return Object.fromEntries(modules.map(m => [m.name, m]));
  }
}