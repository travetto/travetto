import { externalPromise } from '@encore2/base';
import { Class } from '../model/types';
import { ClassSource, ChangedEvent } from './class-source';
import { EventEmitter } from 'events';

export abstract class Registry implements ClassSource {

  classes = new Map<string, Map<string, Class>>();
  initialized = externalPromise();
  events = new EventEmitter();

  constructor(protected source?: ClassSource, private filter?: (e: ChangedEvent) => boolean) {
    if (source) {
      this.listen(source, filter);
    }
  }

  abstract init(): Promise<void>;

  async initialize() {

    if (this.initialized.run()) {
      return await this.initialized;
    }

    try {
      if (this.source) {
        await this.source.init();
      }

      await this.init();
      this.initialized.resolve(true);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async onInstall(cls: Class): Promise<void> {

  }

  async onUninstall(cls: Class): Promise<void> {

  }

  async uninstall(classes: Class | Class[]) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (let cls of classes) {
      if (this.classes.has(cls.__filename) && this.classes.get(cls.__filename)!.has(cls.__id)) {
        await this.onUninstall(cls);
        this.classes.get(cls.__filename)!.delete(cls.__id);
      }
    }
  }

  async install(classes: Class | Class[]) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (let cls of classes) {
      if (!this.classes.has(cls.__filename)) {
        this.classes.set(cls.__filename, new Map());
      }
      this.classes.get(cls.__filename)!.set(cls.__id, cls);
      await this.onInstall(cls);
    }
  }


  async onEvent(event: ChangedEvent) {
    let file = (event.curr || event.prev)!.__filename;

    let prev = new Map();
    if (this.classes.has(file)) {
      prev = new Map(this.classes.get(file)!.entries());
    }

    switch (event.type) {
      case 'removed':
        await this.uninstall(event.prev!);
        break;
      case 'added':
        await this.install(event.curr!);
        break;
      case 'changed':
        await this.uninstall(event.prev!);
        await this.install(event.curr!);
        break;
      default:
        return;
    }

    this.events.emit('change', event);
  }

  on<T>(callback: (e: ChangedEvent) => any, filter?: (e: ChangedEvent) => boolean): void {
    this.events.on('change', filter ? e => filter(e) && callback(e) : callback);
  }

  listen(source: ClassSource, filter?: (e: ChangedEvent) => boolean) {
    source.on(this.onEvent.bind(this), filter);
  }
}