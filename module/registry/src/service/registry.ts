import { externalPromise } from '@encore2/base';
import { Class } from '../model/types';
import { ClassSource, ChangedEvent } from './class-source';

export abstract class Registry extends ClassSource {

  classes = new Map<string, Map<string, Class>>();
  initialized = externalPromise();

  constructor(private parent?: Registry) {
    super();
    if (parent) {
      this.listen(parent);
    }
  }

  abstract _init(): Promise<void>;

  async initialize() {

    if (this.initialized.run()) {
      return await this.initialized;
    }

    try {
      await this._init();
      this.initialized.resolve(true);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  unregister(classes: Class | Class[]) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (let cls of classes) {
      if (this.classes.has(cls.__filename) && this.classes.get(cls.__filename)!.has(cls.__id)) {
        this.classes.get(cls.__filename)!.delete(cls.__id);
      }
    }
  }

  register(classes: Class | Class[]) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (let cls of classes) {
      if (!this.classes.has(cls.__filename)) {
        this.classes.set(cls.__filename, new Map());
      }
      this.classes.get(cls.__filename)!.set(cls.__id, cls);
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
        this.unregister(event.prev!);
        break;
      case 'added':
        this.register(event.curr!);
        break;
      case 'changed':
        this.unregister(event.prev!);
        this.register(event.curr!);
        break;
      default:
        return;
    }

    this.emit(event);
  }

  listen(source: ClassSource, filter?: (e: ChangedEvent) => boolean) {
    source.on(this.onEvent.bind(this), filter);
  }
}