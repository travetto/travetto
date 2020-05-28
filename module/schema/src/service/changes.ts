import { ChangeEvent, Class } from '@travetto/registry';
import { FieldConfig, ALL_VIEW, ClassConfig } from './types';
import { EventEmitter } from 'events';

const id = (c: Class | string) => typeof c === 'string' ? c : c.__id;

interface FieldMapping {
  path: FieldConfig[];
  config: ClassConfig;
}

export interface FieldChangeEvent {
  cls: Class;
  changes: ChangeEvent<FieldConfig>[];
}

interface SubSchemaChange {
  path: FieldConfig[];
  fields: ChangeEvent<FieldConfig>[];
}

interface SchemaChange {
  config: ClassConfig;
  subs: SubSchemaChange[];
}

export interface SchemaChangeEvent {
  cls: Class;
  change: SchemaChange;
}

export const SCHEMA_CHANGE_EVENT = 'schema:change';
export const FIELD_CHANGE_EVENT = 'field:change';

/**
 * Schema change listener.  Handles all changes that occur via the SchemaRegistry
 */
export class $SchemaChangeListener extends EventEmitter {

  private mapping = new Map<string, Map<string, FieldMapping>>();

  /**
   * Reset the listener
   */
  reset() {
    this.mapping.clear();
  }

  /**
   * Clear dependency mappings for a given class
   */
  clearSchemaDependency(cls: Class) {
    this.mapping.delete(id(cls));
  }

  /**
   * Track a specific class for dependencies
   * @param src The target class
   * @param parent The parent class
   * @param path The path within the object hierarchy to arrive at the class
   * @param config The configuration or the class
   */
  trackSchemaDependency(src: Class, parent: Class, path: FieldConfig[], config: ClassConfig) {
    const idValue = id(src);
    if (!this.mapping.has(idValue)) {
      this.mapping.set(idValue, new Map());
    }
    this.mapping.get(idValue)!.set(id(parent), { path, config });
  }

  /**
   * Emit changes to the schema
   * @param cls The class of the event
   * @param changes The changes to send
   */
  emitSchemaChanges({ cls, changes }: FieldChangeEvent) {
    const updates = new Map<string, SchemaChange>();
    const clsId = id(cls);

    if (this.mapping.has(clsId)) {
      const deps = this.mapping.get(clsId)!;
      for (const depClsId of deps.keys()) {
        if (!updates.has(depClsId)) {
          updates.set(depClsId, { config: deps.get(depClsId)!.config, subs: [] });
        }
        const c = deps.get(depClsId)!;
        updates.get(depClsId)!.subs.push({ path: [...c.path], fields: changes });
      }
    }

    for (const key of updates.keys()) {
      this.emit(SCHEMA_CHANGE_EVENT, {
        cls: updates.get(key)!.config.class,
        change: updates.get(key)!
      } as SchemaChangeEvent);
    }
  }

  /**
   * Emit field level changes in the schema
   * @param prev The previous class config
   * @param curr The current class config
   */
  emitFieldChanges({ prev, curr }: ChangeEvent<ClassConfig>) {

    const prevView = prev!.views[ALL_VIEW];
    const currView = curr!.views[ALL_VIEW];

    const prevFields = new Set(prevView.fields);
    const currFields = new Set(currView.fields);

    const changes: ChangeEvent<FieldConfig>[] = [];

    for (const c of currFields) {
      if (!prevFields.has(c)) {
        changes.push({ curr: currView.schema[c], type: 'added' });
      }
    }

    for (const c of prevFields) {
      if (!currFields.has(c)) {
        changes.push({ prev: prevView.schema[c], type: 'removing' });
      }
    }

    // Handle class references changing, but keeping same id
    const compareTypes = (a: Class, b: Class) => '__id' in a ? a.__id === b.__id : a === b;

    for (const c of currFields) {
      if (prevFields.has(c)) {
        const prevSchema = prevView.schema[c];
        const currSchema = currView.schema[c];
        if (
          JSON.stringify(prevSchema) !== JSON.stringify(currSchema) ||
          !compareTypes(prevSchema.type, currSchema.type)
        ) {
          changes.push({ prev: prevView.schema[c], curr: currView.schema[c], type: 'changed' });
        }
      }
    }

    // Send field changes
    this.emit(FIELD_CHANGE_EVENT, { cls: curr!.class, changes } as FieldChangeEvent);

    this.emitSchemaChanges({ cls: curr!.class, changes });
  }
}

export const SchemaChangeListener = new $SchemaChangeListener();