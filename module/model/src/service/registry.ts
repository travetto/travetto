import { Class, SchemaRegistry } from '@encore/schema';
import { ModelOptions } from './types';
import { EventEmitter } from 'events';

export class ModelRegistry {
  static pendingOptions = new Map<Class, Partial<ModelOptions>>();
  static options = new Map<Class, ModelOptions>();
  static events = new EventEmitter();

  static getOptions(cls: Class): ModelOptions {
    return this.options.get(cls) || {};
  }

  static registerOptions(cls: Class, options: Partial<ModelOptions>) {
    if (!this.options.has(cls)) {
      this.options.set(cls, {});
    }
    let conf = this.options.get(cls)!;
    if (options.defaultSort) {
      conf.defaultSort = options.defaultSort;
    }
    if (options.discriminator) {
      conf.discriminator = options.discriminator;
    }
    if (options.extra) {
      conf.extra = Object.assign({}, conf.extra || {}, options.extra);
    }
    if (options.subtypes) {
      conf.subtypes = Object.assign({}, conf.subtypes || {}, options.subtypes);
    }
    if (options.defaultSort) { }
  }

  static finalizeClass<T>(cls: Class<T>) {
    this.options.set(cls, this.pendingOptions.get(cls)!);
    this.pendingOptions.delete(cls);
    process.nextTick(() => this.events.emit('registered', cls));
  }

  static on(key: 'registered', callback: (item: Class) => any): void;
  static on<T>(key: string, callback: (item: T) => any): void {
    this.events.on(key, callback);
  }
}