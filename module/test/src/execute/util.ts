import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';

import { Env, ExecUtil, ShutdownManager, Util, RuntimeIndex, Runtime } from '@travetto/runtime';

/**
 * Simple Test Utilities
 */
export class RunnerUtil {
  /**
   * Add 50 ms to the shutdown to allow for buffers to output properly
   */
  static registerCleanup(scope: string): void {
    ShutdownManager.onGracefulShutdown(() => Util.blockingTimeout(50), `test.${scope}.bufferOutput`);
  }

  /**
   * Determine if a given file path is a valid test file
   */
  static async isTestFile(file: string): Promise<boolean> {
    const reader = readline.createInterface({ input: createReadStream(file) });
    for await (const line of reader) {
      if (line.includes('@Suite')) {
        reader.close();
        return true;
      }
    }
    return false;
  }

  /**
   * Find all valid test files given the globs
   */
  static async getTestImports(globs?: string[]): Promise<string[]> {
    const files = new Set<string>();
    // Collect globs
    if (globs) {
      for await (const item of fs.glob(globs)) {
        files.add(Runtime.workspaceRelative(item));
      }
    }

    const found = RuntimeIndex.find({
      module: m => m.roles.includes('test') || m.roles.includes('std'),
      folder: f => f === 'test',
      file: f => f.role === 'test'
    })
      .filter(f => files.size === 0 || files.has(f.sourceFile));

    const validImports = found
      .map(f => this.isTestFile(f.sourceFile).then(valid => ({ import: f.import, valid })));

    return (await Promise.all(validImports))
      .filter(x => x.valid)
      .map(x => x.import);
  }

  /**
   * Get count of tests for a given set of patterns
   * @param patterns
   * @returns
   */
  static async getTestCount(patterns: string[]): Promise<number> {
    const countRes = await ExecUtil.getResult(
      spawn('npx', ['trv', 'test:count', ...patterns], {
        env: { ...process.env, ...Env.FORCE_COLOR.export(0), ...Env.NO_COLOR.export(true) }
      }),
      { catch: true }
    );
    if (!countRes.valid) {
      throw new Error(countRes.stderr);
    }
    return countRes.valid ? +countRes.stdout : 0;
  }

  /**
   * Determine if we should invoke the debugger
   */
  static get tryDebugger(): boolean {
    return Env.TRV_TEST_BREAK_ENTRY.isTrue;
  }
}