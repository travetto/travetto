import * as fs from 'fs';
import { Cache } from './cache';

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
  cache: Cache
}