import { Compiler } from '@encore2/compiler';
import { Class } from '../model/types';
import { bulkFind } from '@encore2/base';
import { EventEmitter } from 'events';
import { ClassSource, ChangedEvent } from './class-source';
import { PendingRegister } from '../decorator/register';

export class CompilerClassSource implements ClassSource {

  private classes = new Map<string, Map<string, Class>>();
  private events = new EventEmitter();

  async init() {
    let globs = (process.env.SCAN_GLOBS || `${Compiler.frameworkWorkingSet} ${Compiler.prodWorkingSet}`).split(/\s+/);
    for (let glob of globs) {
      let files = await bulkFind(glob, undefined, (p: string) =>
        !Compiler.optionalFiles.test(p) &&
        !Compiler.definitionFiles.test(p) &&
        !p.endsWith('index.ts'));

      for (let file of files) {
        this.classes.set(file, new Map());
        for (let cls of this.computeClasses(file)) {
          this.classes.get(file)!.set(cls.__id, cls);
          this.events.emit('change', { type: 'init', curr: cls });
        }
      }
    }

    console.log('Listening');

    Compiler.on('changed', this.watch.bind(this));
    Compiler.on('removed', this.watch.bind(this));
    Compiler.on('added', this.watch.bind(this));
  }

  on<T>(callback: (e: ChangedEvent) => void, filter?: (e: ChangedEvent) => boolean): void {
    this.events.on('change', filter ? e => filter(e) && callback(e) : callback);
  }

  protected async watch(file: string) {
    if (file.endsWith('index.ts')) {
      return;
    }

    let next = new Map(this.computeClasses(file).map(x => [x.__id, x] as [string, Class]));
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
        this.events.emit('change', { type: 'removed', prev: prev.get(k)! });
      } else if (!prev.has(k)) {
        this.classes.get(file)!.set(k, next.get(k)!);
        this.events.emit('change', { type: 'added', curr: next.get(k) });
      } else {
        this.events.emit('change', { type: 'changed', curr: next.get(k)!, prev: prev.get(k)! });
      }
    }
  }

  private computeClasses(file: string) {
    try {
      let out = require(file);
      // Get and clear after computed
      let classes: Class[] = PendingRegister.get(file)!;
      PendingRegister.delete(file);
      return classes || [];
    } catch (e) {
      return [];
    }
  }
}