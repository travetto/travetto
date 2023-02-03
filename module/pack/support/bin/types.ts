export type PackConfig = {
  workspace: string;
  output: string;
  clean: boolean;
  ejectFile: string;
  module: string;

  // Bundle
  entryPoint: string;
  entryCommand: string;
  minify: boolean;
  sourcemap: boolean;
  includeSources: boolean;

  // Docker
  dockerImage: string;
  dockerName: string;
  dockerTag: string[];
  dockerPort: string[];
  dockerPush: boolean;
  dockerRegistry: string;
};

export type ShellCommandImpl = {
  createScript(file: string, text: string, mode: string): string[][];
  scriptOpen(): string[];
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
