import { EventEmitter } from 'events';

import { Class, ChangeSource, ChangeEvent } from './types';

export abstract class Registry implements ChangeSource<Class> {

  protected resolved: boolean;
  protected initialized: Promise<any>;
  protected events = new EventEmitter();
  protected descendants: Registry[] = [];
  protected parents: ChangeSource<Class>[] = [];

  constructor(...parents: ChangeSource<Class>[]) {
    this.parents = parents;

    if (this.parents.length) {
      for (const parent of this.parents) {
        this.listen(parent);
        if (parent instanceof Registry) {
          parent.descendants.push(this);
        }
      }
    }
  }

  protected async runInit(): Promise<any> {
    try {
      this.resolved = false;

      const waitFor = this.parents.filter(x => !(x instanceof Registry));
      await Promise.all(waitFor.map(x => x.init()));

      const classes = await this.initialInstall();
      if (classes) {
        for (const cls of classes) {
          this.install(cls, { type: 'added', curr: cls });
        }
      }

      await Promise.all(this.descendants.map(x => x.init()));

      console.debug('Initialized', this.constructor.__id);
    } finally {
      this.resolved = true;
    }
  }

  initialInstall(): any {
    return;
  }

  verifyInitialized() {
    if (!this.resolved) {
      throw new Error(`${this.constructor.name} has not been initialized, you probably need to call RootRegistry.init()`);
    }
  }

  async init(): Promise<any> {
    if (!this.initialized) {
      this.initialized = this.runInit();
    }
    return this.initialized;
  }

  onInstall(cls: Class, e: ChangeEvent<Class>): void {

  }

  onUninstall(cls: Class, e: ChangeEvent<Class>): void {

  }

  uninstall(classes: Class | Class[], e: ChangeEvent<Class>) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (const cls of classes) {
      this.onUninstall(cls, e);
    }
  }

  install(classes: Class | Class[], e: ChangeEvent<Class>) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (const cls of classes) {
      this.onInstall(cls, e);
    }
  }

  onEvent(event: ChangeEvent<Class>) {
    console.trace('Received', this.constructor.__id, event.type, (event.curr ?? event.prev)!.__id);

    switch (event.type) {
      case 'removing':
        this.uninstall(event.prev!, event);
        break;
      case 'added':
        this.install(event.curr!, event);
        break;
      case 'changed':
        this.uninstall(event.prev!, event);
        this.install(event.curr!, event);
        break;
      default:
        return;
    }
  }

  emit(e: ChangeEvent<Class>) {
    this.events.emit('change', e);
  }

  on<T>(callback: (e: ChangeEvent<Class>) => any): void {
    this.events.on('change', callback);
  }

  off<T>(callback: (e: ChangeEvent<Class>) => any) {
    this.events.off('change', callback);
  }

  listen(source: ChangeSource<Class>) {
    source.on(this.onEvent.bind(this));
  }

  onReset() { }

  reset() {
    this.onReset();
    for (const des of this.descendants) {
      des.reset();
    }
    delete this.initialized;
  }
}