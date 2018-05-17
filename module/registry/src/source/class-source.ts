import { EventEmitter } from 'events';

import { Compiler } from '@travetto/compiler';
import { findAppFilesByExt } from '@travetto/base';

import { Class } from '../model/types';
import { ChangeSource, ChangeEvent } from './types';
import { PendingRegister } from '../decorator/register';

export class CompilerClassSource implements ChangeSource<Class> {

  private classes = new Map<string, Map<string, Class>>();
  private events = new EventEmitter();

  constructor() {
    this.watch = this.watch.bind(this);
  }

  emit(e: ChangeEvent<Class>) {
    this.events.emit('change', e);
  }

  reset() {
    this.classes.clear();
  }

  async init() {
    const entries = await findAppFilesByExt('.ts')
      .filter(x => (
        x.file.startsWith(`${process.cwd()}/src/`) ||
        (x.file.includes('@travetto/') && x.file.includes('/src/'))
      ));

    console.log(entries.map(x => x.file));

    const files = findAppFilesByExt('.ts')
      .filter(x => Compiler.presenceManager.validFile(x.file))
      .map(x => x.file)

    const extra: string[] = [];

    const requireListen = (file: string) => extra.push(file);

    Compiler.on('required-after', requireListen);

    for (const file of files) {
      this.processClasses(file, this.computeClasses(file));
    }

    for (const file of extra) {
      if (PendingRegister.has(file)) {
        this.processClasses(file, PendingRegister.get(file)!);
        PendingRegister.delete(file);
      }
    }

    Compiler.off('required-after', requireListen);

    Compiler.on('changed', this.watch);
    Compiler.on('removed', this.watch);
    Compiler.on('added', this.watch);
    Compiler.on('required-after', f => this.processClasses(f, PendingRegister.get(f)!));
  }

  protected processClasses(file: string, classes?: Class[]) {
    if (!classes || !classes.length) {
      return;
    }
    this.classes.set(file, new Map());
    for (const cls of classes) {
      this.classes.get(file)!.set(cls.__id, cls);
      this.emit({ type: 'added', curr: cls });
    }
  }

  on(callback: (e: ChangeEvent<Class>) => void): void {
    this.events.on('change', callback);
  }

  protected async watch(file: string) {
    console.debug('Got file', file);
    const next = new Map(this.computeClasses(file).map(x => [x.__id, x] as [string, Class]));
    let prev = new Map<string, Class>();
    if (this.classes.has(file)) {
      prev = new Map(this.classes.get(file)!.entries());
    }

    const keys = new Set([...Array.from(prev.keys()), ...Array.from(next.keys())]);

    if (!this.classes.has(file)) {
      this.classes.set(file, new Map());
    }

    for (const k of keys) {
      if (!next.has(k)) {
        this.emit({ type: 'removing', prev: prev.get(k)! });
        this.classes.get(file)!.delete(k);
      } else {
        this.classes.get(file)!.set(k, next.get(k)!);
        if (!prev.has(k)) {
          this.emit({ type: 'added', curr: next.get(k)! });
        } else if (prev.get(k)!.__hash !== next.get(k)!.__hash) {
          this.emit({ type: 'changed', curr: next.get(k)!, prev: prev.get(k) });
        }
      }
    }
  }

  private computeClasses(file: string) {
    try {
      const out = require(file);
      // Get and clear after computed
      const classes: Class[] = PendingRegister.get(file)!;
      PendingRegister.delete(file);
      return classes || [];
    } catch (e) {
      return [];
    }
  }
}