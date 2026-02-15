import * as vscode from 'vscode';

import { Env, JSONUtil } from '@travetto/runtime';

import { EnvDict, LaunchConfig } from './types.ts';
import { Workspace } from './workspace.ts';

// eslint-disable-next-line no-template-curly-in-string
const WORKSPACE = '${workspaceFolder}';

export class RunUtil {

  static #baseEnv: EnvDict = { ...Env.DEBUG.export('') };

  static buildEnv(module?: string): EnvDict {
    return {
      ...this.#baseEnv,
      ...Env.TRV_MANIFEST.export(undefined),
      ...Env.TRV_MODULE.export(module ?? Workspace.moduleName)
    };
  }

  static registerEnvVars(context: vscode.ExtensionContext, data: Record<string, unknown>): void {
    Object.assign(this.#baseEnv, data);
    for (const [key, value] of Object.entries(data)) {
      context.environmentVariableCollection.replace(key, `${value ?? ''}`);
    }
  }

  /** Generate debug launch config */
  static buildDebugConfig(input: LaunchConfig): vscode.DebugConfiguration {
    if (input.useCli) {
      input.args = [input.main, ...input.args ?? []];
      input.main = Workspace.workspaceIndex.resolvePackageCommand('trv');
    }

    const output = `${WORKSPACE}/${Workspace.outputFolder}`;

    const debugOverrides = vscode.workspace.getConfiguration('travetto.debugOptions');

    const config: vscode.DebugConfiguration = {
      type: 'node',
      request: 'launch',
      name: input.name,
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
      program: input.main.replace(Workspace.path, WORKSPACE),
      cwd: WORKSPACE,
      args: (input.args ?? []).map(arg => `${arg}`),
      env: {
        ...this.buildEnv(input.module),
        ...input.env ?? {},
      },
    };

    return config;
  }

  /** Debug a given config */
  static async debug(config: LaunchConfig): Promise<void> {
    try {
      await vscode.debug.startDebugging(Workspace.folder, this.buildDebugConfig(config));
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : JSONUtil.toUTF8(error));
    }
  }
}