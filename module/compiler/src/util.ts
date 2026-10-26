import fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

import {
  type ManifestContext,
  type ManifestModuleFolderType,
  ManifestModuleUtil,
  type ManifestRoot,
  type Package,
  PackageUtil,
  path
} from '@travetto/manifest';

import type { CompilerServerInfo } from './types';

const sendSignal = (processId: number, signal?: NodeJS.Signals) => {
  try {
    return process.kill(processId, signal ?? 0);
  } catch {
    return false;
  }
};

/**
 * Standard utilities for compiler
 */
export class CompilerUtil {
  static readonly TYPINGS_FOLDER_KEYS = new Set<ManifestModuleFolderType>(['$index', 'support', 'src', '$package']);

  /**
   * Determine if a module file is in a folder whose typings are exported
   */
  static isExternalTypings(moduleFile: string): boolean {
    return this.TYPINGS_FOLDER_KEYS.has(ManifestModuleUtil.getFolderKey(moduleFile));
  }

  /**
   * Get all expected output files for a primary output file
   */
  static getEmittedOutputs(outputFile: string): string[] {
    const baseOutput = ManifestModuleUtil.withoutOutputExtension(outputFile);
    return [
      outputFile,
      `${outputFile}${ManifestModuleUtil.MAP_EXT}`,
      `${baseOutput}${ManifestModuleUtil.TYPINGS_EXT}`,
      `${baseOutput}${ManifestModuleUtil.TYPINGS_EXT}${ManifestModuleUtil.MAP_EXT}`
    ];
  }

  /**
   * Resolve an emitted path to its final output and optional external typings location
   */
  static resolveEmittedFilePath(
    outputFile: string,
    emittedPath: string,
    options?: {
      moduleFile?: string;
      outputPath?: string;
      typingsPath?: string;
    }
  ): { outputLocation: string; typingsLocation?: string } {
    const isMap = emittedPath.endsWith(ManifestModuleUtil.MAP_EXT);
    const isTypings = ManifestModuleUtil.isTypingsWithMapFile(emittedPath);

    const outputLocation = isTypings
      ? `${ManifestModuleUtil.withoutOutputExtension(outputFile)}${ManifestModuleUtil.TYPINGS_EXT}${isMap ? ManifestModuleUtil.MAP_EXT : ''}`
      : isMap
        ? `${outputFile}${ManifestModuleUtil.MAP_EXT}`
        : outputFile;

    let typingsLocation: string | undefined;
    if (isTypings && options?.outputPath && options?.typingsPath && (!options.moduleFile || this.isExternalTypings(options.moduleFile))) {
      typingsLocation = outputLocation.replace(options.outputPath, options.typingsPath);
    }

    return { outputLocation, typingsLocation };
  }
  /**
   * Rewrites the package.json to target output file names, and pins versions
   * @param manifest
   * @param file
   * @param text
   * @returns
   */
  static rewritePackageJSON(manifest: ManifestRoot, text: string): string {
    const pkg: Package = JSON.parse(text);
    if (pkg.files) {
      pkg.files = pkg.files.map(file => ManifestModuleUtil.withOutputExtension(file));
    }
    if (pkg.main) {
      pkg.main = ManifestModuleUtil.withOutputExtension(pkg.main);
    }
    pkg.type = 'module';
    for (const key of ['devDependencies', 'dependencies', 'peerDependencies'] as const) {
      if (key in pkg) {
        for (const dependency of Object.keys(pkg[key] ?? {})) {
          if (dependency in manifest.modules) {
            pkg[key]![dependency] = manifest.modules[dependency].version;
          }
        }
      }
    }
    return JSON.stringify(pkg, null, 2);
  }

  /**
   * Clear package and module scan caches, with optional deletion of compiler output data
   */
  static async clearCaches(context: ManifestContext, deleteOutput = false): Promise<void> {
    if (deleteOutput && process.env.TRV_ROLE !== 'test') {
      await Promise.all(
        [context.build.outputFolder, context.build.typesFolder].map(folder =>
          fs.rm(path.resolve(context.workspace.path, folder), { recursive: true, force: true })
        )
      );
    }
    PackageUtil.clearCache();
    ManifestModuleUtil.clearScanCache();
  }

  /**
   * Terminate processes by PID and wait for it to exit
   */
  static async killProcesses(processIds: (number | undefined)[], timeoutMilliseconds = 3000): Promise<void> {
    const start = Date.now();
    await Promise.all(
      processIds.map(async processId => {
        if (processId && processId > 0 && sendSignal(processId, 'SIGINT')) {
          while (sendSignal(processId) && Date.now() - start < timeoutMilliseconds) {
            await setTimeout(50);
          }
          sendSignal(processId, 'SIGKILL');
        }
      })
    );
  }

  /**
   * Consume all items of an async iterable. The caller is responsible for handling cancellation.
   */
  static async consumeAsyncIterable<T>(input: AsyncIterable<T>, handler: (item: T) => unknown): Promise<void> {
    for await (const event of input) {
      handler(event);
    }
  }

  /**
   * Is the compiler server running?
   */
  static isServerRunning(info: CompilerServerInfo | undefined): info is CompilerServerInfo {
    return !!info && info.state !== 'closed' && info.state !== 'startup';
  }
}
