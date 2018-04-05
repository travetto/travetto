import { Class } from '../model/types';
import { ChangeSource, ChangeEvent } from './change-source';
import { EventEmitter } from 'events';

export abstract class Registry implements ChangeSource<Class> {

  protected resolved: boolean;
  protected initialized: Promise<any>;
  protected events = new EventEmitter();
  protected descendents: Registry[] = [];
  protected parents: ChangeSource<Class>[] = [];

  constructor(...parents: ChangeSource<Class>[]) {
    this.parents = parents;

    if (this.parents.length) {
      for (const parent of this.parents) {
        this.listen(parent);
        if (parent instanceof Registry) {
          parent.descendents.push(this);
        }
      }
    }
  }

  initialInstall(): any {
    return;
  }

  async init(): Promise<any> {
    if (!this.initialized) {
      this.initialized = this._init();
    }
    return this.initialized;
  }

  protected async _init(): Promise<any> {
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

      await Promise.all(this.descendents.map(x => x.init()));

      console.debug('Initialized', this.constructor.__id);
    } catch (e) {
      console.debug(e);
      throw e;
    } finally {
      this.resolved = true;
    }
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
    console.debug('Received', this.constructor.__id, event.type, (event.curr || event.prev)!.__id);

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

  listen(source: ChangeSource<Class>) {
    source.on(this.onEvent.bind(this));
  }

  onReset() { }

  reset() {
    this.onReset();
    for (const des of this.descendents) {
      des.reset();
    }
  }
}