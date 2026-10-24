import fs from 'node:fs/promises';

import { type ManifestContext, ManifestModuleUtil, type ManifestRoot, type Package, PackageUtil, path } from '@travetto/manifest';

/**
 * Standard utilities for compiler
 */
export class CompilerUtil {
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
   * Check if a process ID is currently alive
   */
  static isProcessRunning(processId: number | undefined): boolean {
    if (!processId || processId <= 0) {
      return false;
    }
    try {
      process.kill(processId, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Terminate a process by PID and wait for it to exit
   */
  static async killProcess(processId: number | undefined, timeoutMilliseconds = 3000): Promise<boolean> {
    if (!processId || processId <= 0) {
      return false;
    }
    if (!this.isProcessRunning(processId)) {
      return false;
    }
    try {
      process.kill(processId);
    } catch {
      return false;
    }
    const start = Date.now();
    while (this.isProcessRunning(processId) && Date.now() - start < timeoutMilliseconds) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (this.isProcessRunning(processId)) {
      try {
        process.kill(processId, 'SIGKILL');
      } catch {}
    }
    return true;
  }

  /**
   * Consume all items of an async iterable. The caller is responsible for handling cancellation.
   */
  static async consumeAsyncIterable<T>(input: AsyncIterable<T>, handler: (item: T) => unknown): Promise<void> {
    for await (const event of input) {
      handler(event);
    }
  }
}
