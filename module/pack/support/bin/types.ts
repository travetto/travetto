export type CommonPackConfig = {
  workspace: string;
  output: string;
  clean: boolean;
  ejectFile?: string;
  mainName: string;
  mainScripts?: boolean;
  module: string;

  // Bundle
  rollupConfiguration: string;
  entryPoint: string;
  entryArguments: string[];
  minify: boolean;
  sourcemap: boolean;
  includeSources: boolean;
};


export type DockerPackConfig = {
  dockerFactory: string;
  dockerBuildFlags?: string;
  dockerImage: string;
  dockerName: string;
  dockerTag?: string[];
  dockerPort?: number[];
  dockerPush?: boolean;
  dockerRegistry?: string;
  dockerRuntime: {
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
  copyRecursive(src: string, dest: string): string[];
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