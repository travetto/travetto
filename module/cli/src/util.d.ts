import * as Commander from 'commander';

declare class UtilStatic {
  cwd: string;
  program: typeof Commander;
  dependOn(command: string, args: string[], cwd: string): void;
  loadModule(path: string): void;
  run(args: string[]): void;
}

declare const Util: UtilStatic;