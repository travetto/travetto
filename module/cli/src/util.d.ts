import * as Commander from 'commander';

type Primitive = string | number | boolean | null | undefined;

declare interface colorize {
  (color: string, value: Primitive): string;

  success(value: Primitive): string;
  failure(value: Primitive): string;
  path(value: string): string;
  input(value: Primitive): string;
  output(value: Primitive): string;
  param(value: Primitive): string;
  type(value: Primitive): string;
  description(value: Primitive): string;
  identifier(value: Primitive): string;
  title(value: Primitive): string;
  subtitle(value: Primitive): string;
}

declare class UtilStatic {
  HAS_COLOR: boolean;
  cwd: string;
  program: typeof Commander;
  dependOn(command: string, args?: string[], cwd?: string): void;
  execute(args: string[]): void;
  fork(cmd: string, args?: string[]): Promise<string>;
  colorize: colorize;
  showHelp(commander: typeof Commander, code?: number): void;
}

declare const Util: UtilStatic;