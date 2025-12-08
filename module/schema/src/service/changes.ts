import { EventEmitter } from 'node:events';

import { Class } from '@travetto/runtime';
import { ChangeEvent } from '@travetto/registry';

import { SchemaFieldConfig, SchemaClassConfig } from './types.ts';

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

/**
 * Schema change listener.  Handles all changes that occur via the SchemaRegistryIndex
 */
class $SchemaChangeListener {

  #emitter = new EventEmitter();

  /**
   * On schema field change, emit the change event for the whole schema
   * @param handler The function to call on schema field change
   */
  onFieldChange(handler: (event: FieldChangeEvent) => void): void {
    this.#emitter.on('field', handler);
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
        changes.push({ current: current.fields[field], type: 'create' });
      }
    }

    for (const field of previousFields) {
      if (!currentFields.has(field) && previous) {
        changes.push({ previous: previous.fields[field], type: 'delete' });
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
          changes.push({ previous: previous.fields[field], current: current.fields[field], type: 'update' });
        }
      }
    }

    // Send field changes
    this.#emitter.emit('field', { cls: current!.class, changes });
  }
}

export const SchemaChangeListener = new $SchemaChangeListener();