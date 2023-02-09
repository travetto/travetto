import { ListOptionConfig, OptionConfig } from '@travetto/cli';

export type CommonPackConfig = {
  workspace: string;
  output: string;
  clean: boolean;
  ejectFile: string;
  module: string;

  // Bundle
  entryPoint: string;
  entryCommand: string;
  entryArguments: string[];
  minify: boolean;
  sourcemap: boolean;
  includeSources: boolean;
};

export type CommonPackOptions = {
  workspace: OptionConfig<string>;
  output: OptionConfig<string>;
  clean: OptionConfig<boolean>;
  ejectFile: OptionConfig<string>;

  // Bundle
  entryPoint: OptionConfig<string>;
  entryCommand: OptionConfig<string>;
  minify: OptionConfig<boolean>;
  sourcemap: OptionConfig<boolean>;
  includeSources: OptionConfig<boolean>;
};

export type DockerPackConfig = {
  dockerImage: string;
  dockerName: string;
  dockerTag: string[];
  dockerPort: string[];
  dockerPush: boolean;
  dockerRegistry: string;
} & CommonPackConfig;

export type DockerPackOptions = {
  dockerImage: OptionConfig<string>;
  dockerName: OptionConfig<string>;
  dockerTag: ListOptionConfig<string>;
  dockerPort: ListOptionConfig<string>;
  dockerPush: OptionConfig<boolean>;
  dockerRegistry: OptionConfig<string>;
} & CommonPackOptions;

export type ShellCommandImpl = {
  var(name: string): string;
  createFile(file: string, text: string[], mode?: string): string[][];
  scriptOpen(): string[];
  chdirScript(): string[];
  callCommandWithAllArgs(cmd: string, ...args: string[]): string[];
  copy(src: string, dest: string): string[];
  copyRecursive(src: string, dest: string): string[];
  rmRecursive(dest: string): string[];
  mkdir(dest: string): string[];
  export(key: string, value: string): string[];
  chdir(dest: string): string[];
  comment(message: string): string[];
  zip(output: string): string[];
};