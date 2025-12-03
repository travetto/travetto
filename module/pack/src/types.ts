import { type OutputOptions } from 'rollup';
import type terser from '@rollup/plugin-terser';

export type CommonPackConfig = {
  buildDir: string;
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
    uid: number;
    group: string;
    gid: number;
  };
} & CommonPackConfig;

export type ShellCommandImpl = {
  var(name: string): string;
  createFile(file: string, text: string[], mode?: string): string[][];
  callCommandWithAllArgs(cmd: string, ...args: string[]): string[];
  copy(sourceFile: string, destinationFile: string): string[];
  copyRecursive(sourceFolder: string, destinationFolder: string, inclusive?: boolean): string[];
  rmRecursive(destinationFolder: string): string[];
  mkdir(destinationFolder: string): string[];
  export(key: string, value: string): string[];
  chdir(destinationFolder: string): string[];
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