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
      .filter(x => x.file.includes(`/src/`));

    const files = entries
      .filter(x => Compiler.presenceManager.validFile(x.file))
      .map(x => x.file)

    for (const f of files) { // Load all files, class scanning
      require(f);
    }

    this.flush();

    Compiler.on('changed', this.watch);
    Compiler.on('removed', this.watch);
    Compiler.on('added', this.watch);
    Compiler.on('required-after', f => this.flush());
  }

  private flush() {
    for (const [file, classes] of PendingRegister.flush()) {
      if (!classes || !classes.length) {
        continue;
      }
      this.classes.set(file, new Map());
      for (const cls of classes) {
        this.classes.get(cls.__filename)!.set(cls.__id, cls);
        this.emit({ type: 'added', curr: cls });
      }
    }
  }

  on(callback: (e: ChangeEvent<Class>) => void): void {
    this.events.on('change', callback);
  }

  protected async watch(file: string) {
    console.debug('Got file', file);
    require(file);

    const next = new Map(PendingRegister.flush()
      .filter(x => x[0] === file)[0][1]
      .map(cls => [cls.__id, cls] as [string, Class]));

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
}