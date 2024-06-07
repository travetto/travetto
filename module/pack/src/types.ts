import { type OutputOptions } from 'rollup';
import type terser from '@rollup/plugin-terser';

export type CommonPackConfig = {
  workspace: string;
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

  // Bundle
  rollupConfiguration: string;
  entryPoint: string;
  entryArguments: string[];
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
  scriptOpen(): string[];
  chdirScript(): string[];
  callCommandWithAllArgs(cmd: string, ...args: string[]): string[];
  copy(src: string, dest: string): string[];
  copyRecursive(src: string, dest: string, inclusive?: boolean): string[];
  rmRecursive(dest: string): string[];
  mkdir(dest: string): string[];
  export(key: string, value: string): string[];
  chdir(dest: string): string[];
  comment(message: string): string[];
  echo(text: string): string[];
  zip(output: string): string[];
};

export type DockerPackFactory = (cfg: DockerPackConfig) => (string | Promise<string>);
export type DockerPackFactoryModule = { factory: DockerPackFactory };

export type CoreRollupConfig = {
  envFile?: string;
  output: OutputOptions;
  entry: string;
  files: string[];
  ignore: Set<string>;
  minify: Parameters<typeof terser>[0];
};