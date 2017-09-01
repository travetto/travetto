import { Class, ClassList, FieldConfig, ClassConfig, ViewConfig } from './types';
import { EventEmitter } from 'events';

export class SchemaRegistry {

  static schemas: Map<Class, ClassConfig> = new Map();
  static pending: Map<Class, ClassConfig> = new Map();
  static DEFAULT_VIEW = 'all';
  static events = new EventEmitter();

  static getParent(cls: Class): Class | null {
    let parent = Object.getPrototypeOf(cls) as Class;
    return parent.name && parent !== Object ? parent : null;
  }

  static getPendingViewConfig<T>(target: Class<T>, view: string) {
    let conf = this.getClassConfig(target);
    let viewConf = conf.views[view];
    if (!viewConf) {
      viewConf = conf.views[view] = {
        schema: {},
        fields: []
      };
    }
    return viewConf;
  }

  static getPendingViewSchema<T>(cls: Class<T>, view: string = this.DEFAULT_VIEW) {
    let conf = this.pending.get(cls);
    return conf && conf.views[view].schema;
  }

  static getClassConfig<T>(cls: Class<T>) {

    return this.schemas.get(cls) as ClassConfig;
  }

  static getClass<T>(o: T): Class<T> {
    return o.constructor as any;
  }

  static registerPendingFieldFacet(target: any, prop: string, config: any, view: string = this.DEFAULT_VIEW) {
    let cons = this.getClass(target);
    let defViewConf = this.getPendingViewConfig(cons, this.DEFAULT_VIEW);

    if (!defViewConf.schema[prop]) {
      defViewConf.fields.push(prop);
      defViewConf.schema[prop] = {} as any;
    }

    if (view !== this.DEFAULT_VIEW) {
      let viewConf = this.getPendingViewConfig(cons, view);
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

  static finalizeClass<T>(cls: Class<T>) {
    // Project super types to sub types on access
    let views: { [key: string]: ViewConfig } = {
      [this.DEFAULT_VIEW]: {
        schema: {},
        fields: []
      }
    };

    let parent = this.getParent(cls);
    if (parent) {
      let parentConfig = this.getClassConfig(parent);

      for (let v of Object.keys(parentConfig.views)) {
        let view = parentConfig.views[v];
        views[v] = {
          schema: Object.assign({}, view.schema),
          fields: view.fields.slice(0)
        };
      }
    }

    // Emit schema registered
    this.schemas.set(cls, { views });

    this.events.emit('registered', cls);
  }
}