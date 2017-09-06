import { Class, ClassList, FieldConfig, ClassConfig, ViewConfig } from './types';
import { EventEmitter } from 'events';
import { nodeToPromise } from '@encore/base';

export class SchemaRegistry {

  static schemas: Map<Class, ClassConfig> = new Map();
  private static pending: Map<Class, ClassConfig> = new Map();
  static DEFAULT_VIEW = '__all';
  private static events = new EventEmitter();

  static getParent(cls: Class): Class | null {
    let parent = Object.getPrototypeOf(cls) as Class;
    return parent.name && parent !== Object ? parent : null;
  }

  static getClass<T>(o: T): Class<T> {
    return o.constructor as Class<T>;
  }

  static getPendingViewSchema<T>(cls: Class<T>, view: string = this.DEFAULT_VIEW) {
    let conf = this.pending.get(cls);
    return conf && conf.views[view].schema;
  }

  static getOrCreatePendingViewConfig<T>(target: Class<T>, view: string) {
    if (!this.pending.has(target)) {
      this.pending.set(target, { views: {} });
    }
    let conf = this.pending.get(target)!;
    let viewConf = conf.views[view];
    if (!viewConf) {
      viewConf = conf.views[view] = {
        schema: {},
        fields: []
      };
    }
    return viewConf;
  }

  static registerPendingFieldFacet(target: any, prop: string, config: any, view: string = this.DEFAULT_VIEW) {
    let cons = this.getClass(target);
    let defViewConf = this.getOrCreatePendingViewConfig(cons, this.DEFAULT_VIEW);

    if (!defViewConf.schema[prop]) {
      defViewConf.fields.push(prop);
      defViewConf.schema[prop] = {} as any;
    }

    if (view !== this.DEFAULT_VIEW) {
      let viewConf = this.getOrCreatePendingViewConfig(cons, view);
      if (!viewConf.schema[prop]) {
        viewConf.schema[prop] = defViewConf.schema[prop];
        viewConf.fields.push(prop);
      }
    }

    Object.assign(defViewConf.schema[prop], config);

    return target;
  }

  static registerPendingFieldConfig(target: any, prop: string, type: ClassList) {
    const isArray = Array.isArray(type);
    const fieldConf: FieldConfig = {
      type,
      name: prop,
      declared: {
        array: isArray, type: isArray ? (type as any)[0] : type
      }
    };

    // Get schema if exists
    const schema = this.getPendingViewSchema(fieldConf.declared.type);

    if (schema) {
      fieldConf.type = isArray ? [schema] : schema;
    }

    return this.registerPendingFieldFacet(target, prop, fieldConf);
  }

  static mergeConfigs(dest: ClassConfig, src: ClassConfig) {
    for (let v of Object.keys(src.views)) {
      let view = src.views[v];
      if (v in dest.views) {
        dest.views[v] = {
          schema: Object.assign({}, dest.views[v].schema, view.schema),
          fields: (dest.views[v].fields).concat(view.fields)
        }
      } else {
        dest.views[v] = {
          schema: Object.assign({}, view.schema || {}),
          fields: view.fields.slice(0)
        }
      }
    }
    return dest;
  }

  static finalizeClass<T>(cls: Class<T>) {
    let config: ClassConfig = { views: {} };

    // Merge parent
    let parent = this.getParent(cls);
    if (parent) {
      let parentConfig = this.schemas.get(parent);
      if (parentConfig) {
        config = this.mergeConfigs(config, parentConfig);
      }
    }

    // Merge pending
    let pending = this.pending.get(cls);
    if (pending) {
      config = this.mergeConfigs(config, pending);
      this.pending.delete(cls);
    }

    // Emit schema registered
    this.schemas.set(cls, config);
    this.events.emit('registered', cls);
  }

  static on(event: 'registered', callback: (result: Class) => any): void;
  static on<T>(event: string, callback: (result: T) => any): void {
    this.events.on(event, callback);
  }
}