import * as fs from 'fs';

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
    init: () => { [key: string]: fs.Stats; };
    fromEntryName: (full: string) => string;
    toEntryName: (full: string) => string;
  }
}