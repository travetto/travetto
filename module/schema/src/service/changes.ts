import { EventEmitter } from 'events';

import { Class } from '@travetto/base';
import { ChangeEvent } from '@travetto/registry';

import { FieldConfig, ClassConfig } from './types';
import { AllViewⲐ } from '../internal/types';

const id = (c: Class | string): string => typeof c === 'string' ? c : c.Ⲑid;

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

export interface SchemaChange {
  config: ClassConfig;
  subs: SubSchemaChange[];
}

export interface SchemaChangeEvent {
  cls: Class;
  change: SchemaChange;
}

/**
 * Schema change listener.  Handles all changes that occur via the SchemaRegistry
 */
class $SchemaChangeListener {

  #emitter = new EventEmitter();
  #mapping = new Map<string, Map<string, FieldMapping>>();

  /**
   * On schema change, emit the change event for the whole schema
   * @param cb The function to call on schema change
   */
  onSchemaChange(handler: (e: SchemaChangeEvent) => void): void {
    this.#emitter.on('schema', handler);
  }

  /**
   * On schema field change, emit the change event for the whole schema
   * @param cb The function to call on schema field change
   */
  onFieldChange(handler: (e: FieldChangeEvent) => void): void {
    this.#emitter.on('field', handler);
  }

  /**
   * Reset the listener
   */
  reset(): void {
    this.#mapping.clear();
  }

  /**
   * Clear dependency mappings for a given class
   */
  clearSchemaDependency(cls: Class): void {
    this.#mapping.delete(id(cls));
  }

  /**
   * Track a specific class for dependencies
   * @param src The target class
   * @param parent The parent class
   * @param path The path within the object hierarchy to arrive at the class
   * @param config The configuration or the class
   */
  trackSchemaDependency(src: Class, parent: Class, path: FieldConfig[], config: ClassConfig): void {
    const idValue = id(src);
    if (!this.#mapping.has(idValue)) {
      this.#mapping.set(idValue, new Map());
    }
    this.#mapping.get(idValue)!.set(id(parent), { path, config });
  }

  /**
   * Emit changes to the schema
   * @param cls The class of the event
   * @param changes The changes to send
   */
  emitSchemaChanges({ cls, changes }: FieldChangeEvent): void {
    const updates = new Map<string, SchemaChange>();
    const clsId = id(cls);

    if (this.#mapping.has(clsId)) {
      const deps = this.#mapping.get(clsId)!;
      for (const depClsId of deps.keys()) {
        if (!updates.has(depClsId)) {
          updates.set(depClsId, { config: deps.get(depClsId)!.config, subs: [] });
        }
        const c = deps.get(depClsId)!;
        updates.get(depClsId)!.subs.push({ path: [...c.path], fields: changes });
      }
    }

    for (const key of updates.keys()) {
      this.#emitter.emit('schema', { cls: updates.get(key)!.config.class, change: updates.get(key)! });
    }
  }

  /**
   * Emit field level changes in the schema
   * @param prev The previous class config
   * @param curr The current class config
   */
  emitFieldChanges({ prev, curr }: ChangeEvent<ClassConfig>): void {

    const prevView = prev?.views[AllViewⲐ] || { fields: [], schema: {} };
    const currView = curr!.views[AllViewⲐ];

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
    const compareTypes = (a: Class, b: Class): boolean => 'Ⲑid' in a ? a.Ⲑid === b.Ⲑid : a === b;

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
    this.#emitter.emit('field', { cls: curr!.class, changes });
    this.emitSchemaChanges({ cls: curr!.class, changes });
  }
}

export const SchemaChangeListener = new $SchemaChangeListener();