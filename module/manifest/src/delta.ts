import { type Stats } from 'fs';
import fs from 'fs/promises';
import {
  ManifestDelta, ManifestDeltaEvent, ManifestDeltaModule,
  ManifestModule, ManifestModuleFile, ManifestModuleFolderType,
  ManifestRoot
} from './types';

const VALID_SOURCE_FOLDERS = new Set<ManifestModuleFolderType>(['bin', 'src', 'test', 'support', '$index', '$package', 'doc']);

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
  static async #deltaModules(outputFolder: string, left: ManifestDeltaModule, right: ManifestDeltaModule): Promise<ManifestDeltaEvent[]> {
    const out: ManifestDeltaEvent[] = [];
    const getStat = (f: string): Promise<Stats | void> =>
      fs.stat(`${outputFolder}/${left.output}/${f.replace(/[.]ts$/, '.js')}`).catch(() => { });

    for (const el of Object.keys(left.files)) {

      if (!(el in right.files)) {
        const [, , leftTs] = left.files[el];
        const stat = await getStat(el);
        if (stat && leftTs < this.#getNewest(stat)) {
          // If file pre-exists manifest, be cool
          continue;
        }
        out.push([el, 'added']);
      } else {
        const [, , leftTs] = left.files[el];
        const [, , rightTs] = right.files[el];
        if (leftTs !== rightTs) {
          const stat = await getStat(el);
          if (leftTs > this.#getNewest(stat!)) {
            out.push([el, 'changed']);
          }
        } else {
          try {
            const stat = await getStat(el);
            if (this.#getNewest(stat!) < leftTs) {
              out.push([el, 'dirty']);
            }
          } catch {
            out.push([el, 'missing']);
          }
        }
      }
    }
    for (const el of Object.keys(right.files)) {
      if (!(el in left.files)) {
        const stat = await getStat(el);
        if (stat) {
          out.push([el, 'removed']);
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
        if (type === 'ts' || type === 'js' || type === 'json' || type === 'package-json') {
          out[name] = [name, type, date];
        }
      }
    }
    return out;
  }

  /**
   * Produce delta between ttwo manifest roots, relative to a single output folder
   */
  static async produceDelta(outputFolder: string, left: ManifestRoot, right: ManifestRoot): Promise<ManifestDelta> {
    const deltaLeft = Object.fromEntries(
      Object.values(left.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const deltaRight = Object.fromEntries(
      Object.values(right.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const out: Record<string, ManifestDeltaEvent[]> = {};

    for (const [name, lMod] of Object.entries(deltaLeft)) {
      out[name] = await this.#deltaModules(outputFolder, lMod, deltaRight[name] ?? { files: {}, name });
    }

    return out;
  }
}