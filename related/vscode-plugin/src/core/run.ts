import vscode from 'vscode';

import { Env } from '@travetto/runtime';

import { EnvDict, LaunchConfig } from './types';
import { Workspace } from './workspace';

// eslint-disable-next-line no-template-curly-in-string
const WORKSPACE = '${workspaceFolder}';

export class RunUtil {

  static #baseEnv: EnvDict = { ...Env.DEBUG.export('') };
  static #cliFile: string;

  static get cliFile(): string {
    return this.#cliFile ??= Workspace.resolveImport('@travetto/cli/bin/trv.js');
  }

  static buildEnv(cliModule?: string): EnvDict {
    return {
      ...this.#baseEnv,
      ...Env.TRV_MANIFEST.export(undefined),
      ...Env.TRV_MODULE.export(cliModule ?? Workspace.moduleName)
    };
  }

  static registerEnvVars(context: vscode.ExtensionContext, data: Record<string, unknown>): void {
    Object.assign(this.#baseEnv, data);
    for (const [k, v] of Object.entries(data)) {
      context.environmentVariableCollection.replace(k, `${v ?? ''}`);
    }
  }

  /** Generate debug launch config */
  static buildDebugConfig(config: LaunchConfig): vscode.DebugConfiguration {
    if (config.useCli) {
      config.args = [config.main, ...config.args ?? []];
      config.main = this.cliFile;
    }

    const output = `${WORKSPACE}/${Workspace.outputFolder}`;

    return {
      type: 'node',
      request: 'launch',
      name: config.name,
      program: config.main.replace(Workspace.path, WORKSPACE),
      args: (config.args ?? []).map(x => `${x}`),
      env: {
        ...Env.TRV_CAN_RESTART.export(false),
        ...this.buildEnv(config.cliModule),
        ...Env.TRV_DYNAMIC.export(true),
        ...config.env ?? {},
      },
      cwd: WORKSPACE,
      sourceMaps: true,
      pauseForSourceMap: true,
      runtimeArgs: [],
      outFiles: [`${output}/**/*.js`],
      runtimeSourcemapPausePatterns: [`${output}/**/test/**/*.js`],
      skipFiles: [
        '<node_internals>/**',
        'node:internals/**',
        'internal/**',
        '**/@travetto/runtime/src/console.*',
        '**/@travetto/registry/src/proxy.*',
        '**/@travetto/log/src/**',
        '**/@travetto/test/src/execute/buffer.*',
        '**/@travetto/context/src/service.*',
        '**/@travetto/web/src/util/route.*',
        '**/tslib/**'
      ],
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart',
    };
  }

  /** Debug a given config */
  static async debug(cfg: LaunchConfig): Promise<void> {
    try {
      await vscode.debug.startDebugging(Workspace.folder, this.buildDebugConfig(cfg));
    } catch (err) {
      vscode.window.showErrorMessage(err instanceof Error ? err.message : JSON.stringify(err));
    }
  }
}