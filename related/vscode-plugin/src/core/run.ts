import vscode from 'vscode';

import { Env } from '@travetto/runtime';

import { EnvDict, LaunchConfig } from './types.ts';
import { Workspace } from './workspace.ts';

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
    for (const [key, value] of Object.entries(data)) {
      context.environmentVariableCollection.replace(key, `${value ?? ''}`);
    }
  }

  /** Generate debug launch config */
  static buildDebugConfig(config: LaunchConfig): vscode.DebugConfiguration {
    if (config.useCli) {
      config.args = [config.main, ...config.args ?? []];
      config.main = this.cliFile;
    }

    const output = `${WORKSPACE}/${Workspace.outputFolder}`;

    const debugOverrides = vscode.workspace.getConfiguration('travetto.debugOptions');

    return {
      type: 'node',
      request: 'launch',
      name: config.name,
      sourceMaps: true,
      pauseForSourceMap: true,
      runtimeArgs: [],
      outFiles: [`${output}/**/*.js`],
      runtimeSourcemapPausePatterns: [`${output}/**/test/**/*.js`],
      skipFiles: [
        '<node_internals>/**',
        'node:internals/**',
        'internal/**',
        '**/@travetto/runtime/src/types.*',
        '**/@travetto/runtime/src/console.*',
        '**/@travetto/registry/src/proxy.*',
        '**/@travetto/log/src/**',
        '**/@travetto/test/src/execute/barrier.*',
        '**/@travetto/context/src/service.*',
        '**/@travetto/web/src/util/endpoint.*',
        '**/tslib/**'
      ],
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart',
      ...(typeof debugOverrides === 'object' ? debugOverrides : {}),
      program: config.main.replace(Workspace.path, WORKSPACE),
      cwd: WORKSPACE,
      args: (config.args ?? []).map(arg => `${arg}`),
      env: {
        ...Env.TRV_CAN_RESTART.export(false),
        ...this.buildEnv(config.cliModule),
        ...config.env ?? {},
      },
    };
  }

  /** Debug a given config */
  static async debug(config: LaunchConfig): Promise<void> {
    try {
      await vscode.debug.startDebugging(Workspace.folder, this.buildDebugConfig(config));
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : JSON.stringify(error));
    }
  }
}