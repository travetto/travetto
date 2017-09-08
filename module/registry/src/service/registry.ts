import { externalPromise } from '@encore2/base';
import { Class } from '../model/types';
import { ClassSource, ChangeEvent } from './class-source';
import { EventEmitter } from 'events';

export abstract class Registry implements ClassSource {

  protected initialized = externalPromise();
  protected events = new EventEmitter();
  protected descendents: Registry[] = [];

  constructor(protected parent?: ClassSource) {
    if (parent) {
      this.listen(parent);
      if (parent instanceof Registry) {
        parent.descendents.push(this);
      }
    }
  }

  async initialInstall(): Promise<void> {
    return;
  }

  async init(): Promise<any> {

    if (this.initialized.run()) {
      return await this.initialized;
    }

    try {
      if (this.parent && !(this.parent instanceof Registry)) {
        await this.parent.init();
      }

      let classes = await this.initialInstall();
      if (classes) {
        this.install(classes, { type: 'init', curr: classes });
      }

      await Promise.all(this.descendents.map(x => x.init()));

      this.initialized.resolve(true);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async onInstall(cls: Class, e: ChangeEvent): Promise<void> {

  }

  async onUninstall(cls: Class, e: ChangeEvent): Promise<void> {

  }

  async uninstall(classes: Class | Class[], e: ChangeEvent) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (let cls of classes) {
      await this.onUninstall(cls, e);
    }
  }

  async install(classes: Class | Class[], e: ChangeEvent) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (let cls of classes) {
      await this.onInstall(cls, e);
    }
  }


  async onEvent(event: ChangeEvent) {
    console.log('Received', this.constructor.__id, event.type, (event.curr || event.prev)!.__id);

    switch (event.type) {
      case 'removing':
        await this.uninstall(event.prev!, event);
        break;
      case 'added':
        await this.install(event.curr!, event);
        break;
      case 'changed':
        await this.uninstall(event.prev!, event);
        await this.install(event.curr!, event);
        break;
      default:
        return;
    }

    this.events.emit('change', event);
  }

  emit(e: ChangeEvent) {
    this.events.emit('change', e);
  }

  on<T>(callback: (e: ChangeEvent) => any): void {
    this.events.on('change', callback);
  }

  listen(source: ClassSource) {
    source.on(this.onEvent.bind(this));
  }
}