import * as Commander from 'commander';

declare class UtilStatic {
  cwd: string;
  program: typeof Commander;
  dependOn(command: string, args: string[], cwd: string): void;
  execute(args: string[]): void;
}

declare const Util: UtilStatic;