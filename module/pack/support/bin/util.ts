import fs from 'node:fs/promises';
import { spawn, type SpawnOptions } from 'node:child_process';
import path from 'node:path';

import { RuntimeError, ExecUtil, Runtime, RuntimeIndex } from '@travetto/runtime';

import { ActiveShellCommand } from './shell.ts';

export class PackUtil {
  /**
   * Generate .env file
   */
  static buildEnvFile(env: Record<string, string | number | boolean | undefined>): string[] {
    return Object.entries(env)
      .filter(([, value]) => (value !== undefined))
      .map(([key, value]) => `${key}=${value}`);
  }

  /**
   * Remove directory, determine if errors should be ignored
   * @param sourceDirectory The folder to copy
   * @param destinationDirectory The folder to copy to
   */
  static async copyRecursive(sourceDirectory: string, destinationDirectory: string, inclusive: boolean = false, ignoreFailure = false): Promise<void> {
    try {
      let final = destinationDirectory;
      if (!inclusive) {
        final = path.resolve(destinationDirectory, path.basename(sourceDirectory));
      }
      await fs.mkdir(final, { recursive: true });
      await fs.cp(sourceDirectory, final, { recursive: true });
    } catch {
      if (!ignoreFailure) {
        throw new Error(`Failed to copy ${sourceDirectory} to ${destinationDirectory}`);
      }
    }
  }

  /**
   * Finalize eject output
   */
  static async writeEjectOutput(workspace: string, module: string, output: AsyncIterable<string>, file: string): Promise<void> {
    const repoRoot = Runtime.workspaceRelative('.');
    const vars = { ROOT: path.resolve(), TRV_OUT: RuntimeIndex.outputRoot, REPO_ROOT: repoRoot, DIST: workspace, MODULE: module };

    const replaceArgs = (text: string): string => Object.entries(vars)
      .reduce((result, [key, value]) => result.replaceAll(value, ActiveShellCommand.var(key)), text);

    const preamble = ActiveShellCommand.script(
      Object.entries(vars).map(([key, value]) => ActiveShellCommand.export(key, value).join(' ')),
    ).contents;

    let stream: fs.FileHandle | undefined;

    if (!(file === '-' || file === '/dev/stdout')) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, '', 'utf8');
      stream = await fs.open(file, 'w', 0o755);
    }

    const write = (text: string): Promise<unknown> | unknown => stream ? stream.write(`${text}\n`) : process.stdout.write(`${text}\n`);

    for (const line of preamble) {
      write(line);
    }
    for await (const line of output) {
      await write(replaceArgs(line));
    }
    await write('\n');

    await stream?.close();
  }

  /**
   * Track result response
   */
  static async runCommand(cmd: string[], options: SpawnOptions = {}): Promise<string> {
    const { valid, code, stderr, message, stdout } = await ExecUtil.getResult(spawn(cmd[0], cmd.slice(1), {
      stdio: [0, 'pipe', 'pipe'],
      ...options,
    }), { catch: true });

    if (!valid) {
      process.exitCode = code;
      throw new RuntimeError(stderr || message || 'An unexpected error has occurred');
    }
    return stdout;
  }

  /**
   * Write a file directly
   */
  static async writeRawFile(file: string, contents: string[], mode?: string): Promise<void> {
    await fs.writeFile(file, contents.join('\n'), { encoding: 'utf8', mode });
  }
}