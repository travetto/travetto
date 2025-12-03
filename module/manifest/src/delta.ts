import fs from 'node:fs/promises';

import { ManifestModuleUtil } from './module.ts';
import { path } from './path.ts';

import type { ManifestModule, ManifestModuleCore, ManifestModuleFile, ManifestRoot } from './types/manifest.ts';
import type { ManifestModuleFileType, ManifestModuleFolderType } from './types/common.ts';
import type { ManifestContext } from './types/context.ts';

type DeltaEventType = 'added' | 'changed' | 'removed' | 'missing' | 'dirty';
type DeltaModule = ManifestModuleCore & { files: Record<string, ManifestModuleFile> };
export type DeltaEvent = { file: string, type: DeltaEventType, module: string, sourceFile: string };

const VALID_SOURCE_FOLDERS = new Set<ManifestModuleFolderType>(['bin', 'src', 'test', 'support', '$index', '$package', 'doc']);
const VALID_SOURCE_TYPE = new Set<ManifestModuleFileType>(['js', 'ts', 'package-json']);
const VALID_OUTPUT_TYPE = new Set<ManifestModuleFileType>([...VALID_SOURCE_TYPE, 'typings']);

const TypedObject: { keys<T = unknown, K extends keyof T = keyof T>(item: T): K[] } & ObjectConstructor = Object;

/**
 * Produce delta for the manifest
 */
export class ManifestDeltaUtil {

  static #getNewest(stat: { mtimeMs: number, ctimeMs: number }): number {
    return Math.max(stat.mtimeMs, stat.ctimeMs);
  }

  /**
   * Produce delta between two manifest modules, relative to an output folder
   */
  static async #deltaModules(ctx: ManifestContext, outputFolder: string, left: DeltaModule): Promise<DeltaEvent[]> {
    const out: DeltaEvent[] = [];

    const add = (file: string, type: DeltaEvent['type']): unknown =>
      out.push({ file, module: left.name, type, sourceFile: path.resolve(ctx.workspace.path, left.sourceFolder, file) });

    const root = path.resolve(ctx.workspace.path, ctx.build.outputFolder, left.outputFolder);
    const right = new Set(
      (await ManifestModuleUtil.scanFolder(ctx, root, left.main))
        .filter(file => {
          const type = ManifestModuleUtil.getFileType(file);
          return VALID_SOURCE_TYPE.has(type);
        })
        .map(file => ManifestModuleUtil.withoutSourceExtension(file.replace(`${root}/`, '')))
    );

    for (const file of Object.keys(left.files)) {
      const output = ManifestModuleUtil.withOutputExtension(`${outputFolder}/${left.outputFolder}/${file}`);
      const [, , leftTimestamp] = left.files[file];
      const stat = await fs.stat(output).catch(() => undefined);
      right.delete(ManifestModuleUtil.withoutSourceExtension(file));

      if (!stat) {
        add(file, 'added');
      } else {
        const rightTimestamp = this.#getNewest(stat);
        if (leftTimestamp > rightTimestamp) {
          add(file, 'changed');
        }
      }
    }
    // Deleted
    for (const file of right) {
      add(file, 'removed');
    }
    return out;
  }

  /**
   * Collapse all files in a module
   * @param {ManifestModule} mod
   * @returns {}
   */
  static #flattenModuleFiles(mod: ManifestModule): Record<string, ManifestModuleFile> {
    const out: Record<string, ManifestModuleFile> = {};
    for (const key of TypedObject.keys(mod.files)) {
      if (!VALID_SOURCE_FOLDERS.has(key)) {
        continue;
      }
      for (const [name, type, date] of mod.files?.[key] ?? []) {
        if (VALID_OUTPUT_TYPE.has(type)) {
          out[name] = [name, type, date];
        }
      }
    }
    return out;
  }

  /**
   * Produce delta between manifest root and the output folder
   */
  static async produceDelta(manifest: ManifestRoot): Promise<DeltaEvent[]> {
    const deltaLeft = Object.fromEntries(
      Object.values(manifest.modules)
        .map(mod => [mod.name, { ...mod, files: this.#flattenModuleFiles(mod) }])
    );

    const out: DeltaEvent[] = [];
    const outputFolder = path.resolve(manifest.workspace.path, manifest.build.outputFolder);

    for (const leftMod of Object.values(deltaLeft)) {
      out.push(...await this.#deltaModules(manifest, outputFolder, leftMod));
    }

    return out;
  }
}