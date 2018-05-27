export declare const AppEnv: {
  prod: boolean;
  dev: boolean;
  test: boolean;
  watch: boolean;
  all: string[];
  docker: boolean;
  debug: boolean;
  cwd: string;
  is: (env: string) => boolean;
  cache: {
    dir: string;
    sep: string;
    name: string;
    sepRe: RegExp;
    fromEntryName: (full: string) => string;
    toEntryName: (full: string) => string;
  }
}