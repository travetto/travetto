import { type Stats } from 'fs';
import fs from 'fs/promises';

import {
  ManifestModule, ManifestModuleCore, ManifestModuleFile, ManifestModuleFileType, ManifestModuleFolderType, ManifestRoot
} from '@travetto/manifest';

export type ManifestDeltaEventType = 'added' | 'changed' | 'removed' | 'missing' | 'dirty';
export type ManifestDeltaModule = ManifestModuleCore & { files: Record<string, ManifestModuleFile> };
export type ManifestDeltaEvent = { file: string, type: ManifestDeltaEventType, module: string };
export type ManifestDelta = Record<string, ManifestDeltaEvent[]>;

const VALID_SOURCE_FOLDERS = new Set<ManifestModuleFolderType>(['bin', 'src', 'test', 'support', '$index', '$package', 'doc']);
const VALID_SOURCE_TYPE = new Set<ManifestModuleFileType>(['js', 'ts', 'package-json']);

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
  static async #deltaModules(outputFolder: string, left: ManifestDeltaModule): Promise<ManifestDeltaEvent[]> {
    const out: ManifestDeltaEvent[] = [];
    const getStat = (f: string): Promise<Stats | void> =>
      fs.stat(`${outputFolder}/${left.output}/${f.replace(/[.]ts$/, '.js')}`).catch(() => { });

    const add = (file: string, type: ManifestDeltaEvent['type']): unknown =>
      out.push({ file, module: left.name, type });

    for (const el of Object.keys(left.files)) {
      const [, , leftTs] = left.files[el];
      const stat = await getStat(el);
      if (!stat) {
        add(el, 'added');
      } else {
        const rightTs = this.#getNewest(stat);
        if (leftTs > rightTs) {
          add(el, 'changed');
        }
      }
    }
    return out;
  }

  /**
   * Collapse all files in a module
   * @param {ManifestModule} m
   * @returns {}
   */
  static #flattenModuleFiles(m: ManifestModule): Record<string, ManifestModuleFile> {
    const out: Record<string, ManifestModuleFile> = {};
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const key of Object.keys(m.files) as (ManifestModuleFolderType[])) {
      if (!VALID_SOURCE_FOLDERS.has(key)) {
        continue;
      }
      for (const [name, type, date] of m.files?.[key] ?? []) {
        if (VALID_SOURCE_TYPE.has(type)) {
          out[name] = [name, type, date];
        }
      }
    }
    return out;
  }

  /**
   * Produce delta between manifest and the target output
   */
  static async produceDelta(outputFolder: string, root: ManifestRoot): Promise<ManifestDelta> {
    const deltaLeft = Object.fromEntries(
      Object.values(root.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const out: Record<string, ManifestDeltaEvent[]> = {};

    for (const [name, lMod] of Object.entries(deltaLeft)) {
      out[name] = await this.#deltaModules(outputFolder, lMod);
    }

    return out;
  }
}