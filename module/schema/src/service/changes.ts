import { EventEmitter } from 'node:events';

import { Class } from '@travetto/runtime';
import { ChangeEvent } from '@travetto/registry';

import { SchemaFieldConfig, SchemaClassConfig } from './types.ts';

interface FieldMapping {
  path: SchemaFieldConfig[];
  config: SchemaClassConfig;
}

export interface FieldChangeEvent {
  cls: Class;
  changes: ChangeEvent<SchemaFieldConfig>[];
}

interface SubSchemaChange {
  path: SchemaFieldConfig[];
  fields: ChangeEvent<SchemaFieldConfig>[];
}

export interface SchemaChange {
  config: SchemaClassConfig;
  subs: SubSchemaChange[];
}

export interface SchemaChangeEvent {
  cls: Class;
  change: SchemaChange;
}

/**
 * Schema change listener.  Handles all changes that occur via the SchemaRegistryIndex
 */
class $SchemaChangeListener {

  #emitter = new EventEmitter();
  #mapping = new Map<string, Map<string, FieldMapping>>();

  /**
   * On schema change, emit the change event for the whole schema
   * @param handler The function to call on schema change
   */
  onSchemaChange(handler: (event: SchemaChangeEvent) => void): void {
    this.#emitter.on('schema', handler);
  }

  /**
   * On schema field change, emit the change event for the whole schema
   * @param handler The function to call on schema field change
   */
  onFieldChange(handler: (event: FieldChangeEvent) => void): void {
    this.#emitter.on('field', handler);
  }

  /**
   * Clear dependency mappings for a given class
   */
  clearSchemaDependency(cls: Class): void {
    this.#mapping.delete(cls.Ⲑid);
  }

  /**
   * Track a specific class for dependencies
   * @param cls The target class
   * @param parent The parent class
   * @param path The path within the object hierarchy to arrive at the class
   * @param config The configuration or the class
   */
  trackSchemaDependency(cls: Class, parent: Class, path: SchemaFieldConfig[], config: SchemaClassConfig): void {
    const idValue = cls.Ⲑid;
    if (!this.#mapping.has(idValue)) {
      this.#mapping.set(idValue, new Map());
    }
    this.#mapping.get(idValue)!.set(parent.Ⲑid, { path, config });
  }

  /**
   * Emit changes to the schema
   * @param cls The class of the event
   * @param changes The changes to send
   */
  emitSchemaChanges({ cls, changes }: FieldChangeEvent): void {
    const updates = new Map<string, SchemaChange>();
    const clsId = cls.Ⲑid;

    if (this.#mapping.has(clsId)) {
      const dependencies = this.#mapping.get(clsId)!;
      for (const dependencyClsId of dependencies.keys()) {
        if (!updates.has(dependencyClsId)) {
          updates.set(dependencyClsId, { config: dependencies.get(dependencyClsId)!.config, subs: [] });
        }
        const childDependency = dependencies.get(dependencyClsId)!;
        updates.get(dependencyClsId)!.subs.push({ path: [...childDependency.path], fields: changes });
      }
    }

    for (const key of updates.keys()) {
      this.#emitter.emit('schema', { cls: updates.get(key)!.config.class, change: updates.get(key)! });
    }
  }

  /**
   * Emit field level changes in the schema
   * @param previous The previous class config
   * @param current The current class config
   */
  emitFieldChanges(event: ChangeEvent<SchemaClassConfig>): void {
    const previous = 'previous' in event ? event.previous : undefined;
    const current = 'current' in event ? event.current : undefined;

    const previousFields = new Set(Object.keys(previous?.fields ?? {}));
    const currentFields = new Set(Object.keys(current?.fields ?? {}));

    const changes: ChangeEvent<SchemaFieldConfig>[] = [];

    for (const field of currentFields) {
      if (!previousFields.has(field) && current) {
        changes.push({ current: current.fields[field], type: 'added' });
      }
    }

    for (const field of previousFields) {
      if (!currentFields.has(field) && previous) {
        changes.push({ previous: previous.fields[field], type: 'removing' });
      }
    }

    // Handle class references changing, but keeping same id
    const compareTypes = (a: Class, b: Class): boolean => a.Ⲑid ? a.Ⲑid === b.Ⲑid : a === b;

    for (const field of currentFields) {
      if (previousFields.has(field) && previous && current) {
        const prevSchema = previous.fields[field];
        const currSchema = current.fields[field];
        if (
          JSON.stringify(prevSchema) !== JSON.stringify(currSchema) ||
          !compareTypes(prevSchema.type, currSchema.type)
        ) {
          changes.push({ previous: previous.fields[field], current: current.fields[field], type: 'changed' });
        }
      }
    }

    // Send field changes
    this.#emitter.emit('field', { cls: current!.class, changes });
    this.emitSchemaChanges({ cls: current!.class, changes });
  }
}

export const SchemaChangeListener = new $SchemaChangeListener();