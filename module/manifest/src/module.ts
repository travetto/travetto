import fs from 'node:fs/promises';

import { path } from './path';
import { PackageModuleVisitor } from './dependencies';

import type { ManifestModuleFileType, ManifestModuleRole, ManifestModuleFolderType } from './types/common';
import type { ManifestModuleFile, ManifestModule, PackageModule } from './types/manifest';
import type { ManifestContext } from './types/context';

const EXT_MAPPING: Record<string, ManifestModuleFileType> = {
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.json': 'json',
  '.ts': 'ts',
  '.tsx': 'ts',
  '.md': 'md'
};

const INDEX_FILES = new Set(
  ['__index__', '__index', 'index', 'jsx-runtime'].flatMap(f =>
    ['ts', 'tsx', 'js'].map(ext => `${f}.${ext}`)
  )
);

const STD_TOP_FOLDERS = new Set(['src', 'bin', 'support']);
const STD_TOP_FILES = new Set([...INDEX_FILES, 'package.json']);

const SUPPORT_FILE_MAP: Record<string, ManifestModuleRole> = {
  transformer: 'compile',
  compile: 'compile',
  test: 'test',
  doc: 'doc',
  pack: 'build',
  FILEld: 'build'
};

const SUPPORT_FILE_RE = new RegExp(`^support[/](?<name>${Object.keys(SUPPORT_FILE_MAP).join('|')})[./]`);

export class ManifestModuleUtil {

  static #scanCache: Record<string, string[]> = {};

  static #getNewest(stat: { mtimeMs: number, ctimeMs: number }): number {
    return Math.max(stat.mtimeMs, stat.ctimeMs);
  }

  /**
   * Replace a source file's extension with a given value
   */
  static #sourceToExtension(inputFile: string, ext: string): string {
    return inputFile.replace(/[.][tj]sx?$/, ext);
  }

  /**
   * Simple file scanning
   */
  static async scanFolder(ctx: ManifestContext, folder: string, full = false): Promise<string[]> {
    const key = `${folder}|${full}`;
    if (key in this.#scanCache) {
      return this.#scanCache[key];
    }

    if (!await fs.stat(folder).catch(() => false)) {
      return [];
    }

    const out: string[] = [];

    const exclude = new Set([
      path.resolve(ctx.workspace.path, ctx.build.compilerFolder),
      path.resolve(ctx.workspace.path, ctx.build.outputFolder),
      path.resolve(ctx.workspace.path, ctx.build.toolFolder),
    ]);

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
      if (exclude.has(top)) {
        continue;
      }

      for (const sub of await fs.readdir(top)) {
        const valid = !sub.startsWith('.') && (depth > 0 || full);
        const stat = await fs.stat(`${top}/${sub}`);
        if (stat.isFile()) {
          if (valid || STD_TOP_FILES.has(sub)) {
            out.push(`${top}/${sub}`);
          }
        } else {
          if (!sub.includes('node_modules') && (valid || STD_TOP_FOLDERS.has(sub))) {
            stack.push([`${top}/${sub}`, depth + 1]);
          }
        }
      }
    }

    return this.#scanCache[key] = out;
  }

  /**
   * Get file type for a file name
   */
  static getFileType(moduleFile: string): ManifestModuleFileType {
    if (moduleFile.endsWith('package.json')) {
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
  static getFileRole(moduleFile: string): ManifestModuleRole | undefined {
    const matched = SUPPORT_FILE_MAP[moduleFile.match(SUPPORT_FILE_RE)?.groups?.name ?? ''];
    if (matched) {
      return matched;
    } else if (moduleFile.startsWith('test/')) {
      return 'test';
    } else if (moduleFile.startsWith('doc/') || /^DOC[.]tsx?$/.test(moduleFile)) {
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
      } else if (/^support\/transformer[./]/.test(moduleFile)) {
        return '$transformer';
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
    } else if (/^DOC[.]tsx?$/.test(moduleFile)) {
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
    const role = this.getFileRole(moduleFile);
    return role ? [...res, role] : res;
  }

  /**
   * Visit a module and describe files, and metadata
   */
  static async describeModule(ctx: ManifestContext, mod: PackageModule): Promise<ManifestModule> {
    const { state, ...rest } = mod;
    const sourcePath = path.resolve(ctx.workspace.path, rest.sourceFolder);

    const files: ManifestModule['files'] = {};

    for (const file of await this.scanFolder(ctx, sourcePath, rest.main)) {
      // Group by top folder
      const moduleFile = file.replace(`${sourcePath}/`, '');
      const entry = await this.transformFile(moduleFile, file);
      const key = this.getFolderKey(moduleFile);
      (files[key] ??= []).push(entry);
    }

    return {
      ...rest,
      roles: [...state.roleSet].sort(),
      parents: [...state.parentSet].sort(),
      files
    };
  }

  /**
   * Produce all modules for a given manifest folder, adding in some given modules when developing framework
   */
  static async produceModules(ctx: ManifestContext): Promise<Record<string, ManifestModule>> {
    const pkgs = await PackageModuleVisitor.visit(ctx);
    const modules = await Promise.all([...pkgs].map(x => this.describeModule(ctx, x)));
    return Object.fromEntries(modules.map(m => [m.name, m]));
  }

  /**
   * Get the output file name for a given input
   */
  static sourceToOutputExt(inputFile: string): string {
    return this.#sourceToExtension(inputFile, '.js');
  }

  /**
   * Get the file without an extension
   */
  static sourceToBlankExt(inputFile: string): string {
    return this.#sourceToExtension(inputFile, '');
  }
}