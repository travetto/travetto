import * as path from 'path';
import { EventEmitter } from 'events';

import { bulkRequire, AppEnv, externalPromise, bulkFind } from '@encore2/base';
import { RetargettingHandler, Compiler } from '@encore2/compiler';
import { Class } from '../model/types';
import { Registry } from './registry';

export class RootRegistry extends Registry {

  static async _init() {

    // Do not include test files
    let globs = (process.env.SCAN_GLOBS || `${Compiler.frameworkWorkingSet} ${Compiler.prodWorkingSet}`).split(/\s+/);
    for (let glob of globs) {
      let files = await bulkFind(glob, undefined, (p: string) =>
        !Compiler.optionalFiles.test(p) &&
        !Compiler.definitionFiles.test(p) &&
        !p.endsWith('index.ts'));

      for (let file of files) {
        if (!this.classes.has(file)) {
          let res = this.getClasses(file);
          this.register(res);
        }
      }
    }

    // Process dependants first
    let i = 0;
    while (i < this.dependents.length) {
      await this.dependents[i];
      i++;
    }

    // Will only fire in watch mode
    Compiler.on('changed', p => this.doWatch.bind(this));
    Compiler.on('removed', p => this.doWatch.bind(this));
    Compiler.on('added', p => this.doWatch.bind(this));
  }

  protected static doWatch(file: string) {
    if (file.endsWith('index.ts')) {
      return;
    }
    let classes = this.getClasses(file);
    return super.watchChanged(file, classes);
  }

  private static getClasses(file: string) {
    let out = require(file);
    let classes: Class[] = Object.values(out || {}).filter(x => !!x.__filename);
    return classes;
  }
}