import { Compiler } from '@encore2/compiler';
import { Class } from '../model/types';
import { bulkFind } from '@encore2/base';
import { EventEmitter } from 'events';
import { ClassSource, ChangedEvent } from './class-source';

export class CompilerClassSource extends ClassSource {

  private classes = new Map<string, Map<string, Class>>();

  async init() {
    let globs = (process.env.SCAN_GLOBS || `${Compiler.frameworkWorkingSet} ${Compiler.prodWorkingSet}`).split(/\s+/);
    for (let glob of globs) {
      let files = await bulkFind(glob, undefined, (p: string) =>
        !Compiler.optionalFiles.test(p) &&
        !Compiler.definitionFiles.test(p) &&
        !p.endsWith('index.ts'));

      for (let file of files) {
        this.classes.set(file, new Map());
        for (let cls of this.getClasses(file)) {
          this.classes.get(file)!.set(cls.__id, cls);
          this.emit({ type: 'init', curr: cls });
        }
      }
    }

    console.log('Listening');

    Compiler.on('changed', this.watch.bind(this));
    Compiler.on('removed', this.watch.bind(this));
    Compiler.on('added', this.watch.bind(this));
  }

  protected async watch(file: string) {
    if (file.endsWith('index.ts')) {
      return;
    }

    let next = new Map(this.getClasses(file).map(x => [x.__id, x] as [string, Class]));
    let prev = new Map();
    if (this.classes.has(file)) {
      prev = new Map(this.classes.get(file)!.entries());
    }

    let keys = new Set([...prev.keys(), ...next.keys()]);

    for (let k of keys) {
      if (!this.classes.has(file)) {
        this.classes.set(file, new Map());
      }
      if (!next.has(k)) {
        this.classes.get(file)!.delete(k);
        this.emit({ type: 'removed', prev: prev.get(k)! });
      } else if (!prev.has(k)) {
        this.classes.get(file)!.set(k, next.get(k)!);
        this.emit({ type: 'added', curr: next.get(k) });
      } else {
        this.emit({ type: 'changed', curr: next.get(k)!, prev: prev.get(k)! });
      }
    }
  }

  private getClasses(file: string) {
    try {
      let out = require(file);
      let classes: Class[] = Object.values(out || {}).filter(x => !!x.__filename);
      return classes;
    } catch (e) {
      return [];
    }
  }
}