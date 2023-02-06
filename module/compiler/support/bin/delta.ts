import fs from 'fs/promises';
import path from 'path';

import type {
  ManifestContext, ManifestModule, ManifestModuleCore, ManifestModuleFile,
  ManifestModuleFileType, ManifestModuleFolderType, ManifestRoot, ManifestModuleUtil as ModUtil
} from '@travetto/manifest';

type DeltaEventType = 'added' | 'changed' | 'removed' | 'missing' | 'dirty';
type DeltaModule = ManifestModuleCore & { files: Record<string, ManifestModuleFile> };
export type DeltaEvent = { file: string, type: DeltaEventType, module: string };

const VALID_SOURCE_FOLDERS = new Set<ManifestModuleFolderType>(['bin', 'src', 'test', 'support', '$index', '$package', 'doc']);
const VALID_SOURCE_TYPE = new Set<ManifestModuleFileType>(['js', 'ts', 'package-json']);

/**
 * Import the manifest utils once compiled
 */
const importManifestModuleUtil = (ctx: ManifestContext): Promise<{ ManifestModuleUtil: typeof ModUtil }> =>
  import(path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', '@travetto', 'manifest', 'src', 'module.js'));

/**
 * Produce delta for the manifest
 */
export class CompilerDeltaUtil {

  static #getNewest(stat: { mtimeMs: number, ctimeMs: number }): number {
    return Math.max(stat.mtimeMs, stat.ctimeMs);
  }

  /**
   * Produce delta between two manifest modules, relative to an output folder
   */
  static async #deltaModules(ctx: ManifestContext, outputFolder: string, left: DeltaModule): Promise<DeltaEvent[]> {
    const out: DeltaEvent[] = [];
    const { ManifestModuleUtil } = await importManifestModuleUtil(ctx);

    const add = (file: string, type: DeltaEvent['type']): unknown =>
      out.push({ file, module: left.name, type });

    const root = `${ctx.workspacePath}/${ctx.outputFolder}/${left.output}`;
    const right = new Set(
      (await ManifestModuleUtil.scanFolder(root, left.main))
        .map(x => x.replace(`${root}/`, '').replace(/[.]js$/, '.ts'))
        .filter(x => (x.endsWith('.ts') || x.endsWith('.json')))
    );

    for (const el of Object.keys(left.files)) {
      const output = `${outputFolder}/${left.output}/${el.replace(/[.]ts$/, '.js')}`;
      const [, , leftTs] = left.files[el];
      const stat = await fs.stat(output).catch(() => { });
      right.delete(el);
      if (!stat) {
        add(el, 'added');
      } else {
        const rightTs = this.#getNewest(stat);
        if (leftTs > rightTs) {
          add(el, 'changed');
        }
      }
    }
    // Deleted
    for (const el of right) {
      add(el, 'removed');
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
   * Produce delta between manifest root and the output folder
   */
  static async produceDelta(ctx: ManifestContext, manifest: ManifestRoot): Promise<DeltaEvent[]> {
    const deltaLeft = Object.fromEntries(
      Object.values(manifest.modules)
        .map(m => [m.name, { ...m, files: this.#flattenModuleFiles(m) }])
    );

    const out: DeltaEvent[] = [];
    const outputFolder = path.resolve(ctx.workspacePath, ctx.outputFolder);

    for (const lMod of Object.values(deltaLeft)) {
      out.push(...await this.#deltaModules(manifest, outputFolder, lMod));
    }

    return out;
  }
}