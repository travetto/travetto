import { type OutputOptions } from 'rollup';
import type terser from '@rollup/plugin-terser';

export type CommonPackConfig = {
  buildDirectory: string;
  output: string;
  clean: boolean;
  ejectFile?: string;
  mainName: string;
  mainFile: string;
  mainScripts?: boolean;
  module: string;
  envFile: string;
  env?: string;
  manifestFile: string;
  workspaceResourceFolder: string;

  // Bundle
  rollupConfiguration: string;
  entryPoint: string;
  entryArguments: string[];
  externalDependencies: string[];
  minify: boolean;
  sourcemap: boolean;
  includeSources: boolean;
  includeWorkspaceResources?: boolean;
};

export type DockerPackConfig = {
  dockerFactory: string;
  dockerBuildPlatform?: string;
  dockerImage: string;
  dockerName: string;
  dockerTag?: string[];
  dockerPort?: number[];
  dockerPush?: boolean;
  dockerRegistry?: string;
  dockerRuntime: {
    os?: 'alpine' | 'debian' | 'centos' | 'unknown';
    packages?: string[];
    folder: string;
    user: string;
    userId: number;
    group: string;
    groupId: number;
  };
} & CommonPackConfig;

export type ShellCommandProvider = {
  var(name: string): string;
  createFile(file: string, text: string[], mode?: string): string[][];
  callCommandWithAllArgs(cmd: string, ...args: string[]): string[];
  copy(sourceFile: string, destinationFile: string): string[];
  copyRecursive(sourceDirectory: string, destinationDirectory: string, inclusive?: boolean): string[];
  rmRecursive(destinationDirectory: string): string[];
  mkdir(destinationDirectory: string): string[];
  export(key: string, value: string): string[];
  chdir(destinationDirectory: string): string[];
  comment(message: string): string[];
  echo(text: string): string[];
  zip(output: string): string[];
  script(lines: string[], chdir?: boolean): { ext: string, contents: string[] };
};

export type DockerPackFactory = (config: DockerPackConfig) => (string | Promise<string>);
export type DockerPackFactoryModule = { factory: DockerPackFactory };

export type CoreRollupConfig = {
  envFile?: string;
  output: OutputOptions;
  entry: string;
  files: string[];
  ignore: Set<string>;
  external: string[];
  minify: Parameters<typeof terser>[0];
};