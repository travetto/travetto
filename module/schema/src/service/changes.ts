import { ChangeEvent, Class } from '@travetto/registry';
import { FieldConfig, ALL_VIEW, ClassConfig } from './types';
import { EventEmitter } from 'events';

const id = (c: Class | string) => typeof c === 'string' ? c : c.__id;

interface FieldMapping {
  path: string[];
  config: ClassConfig;
}

export interface FieldChangeEvent {
  cls: Class;
  changes: ChangeEvent<FieldConfig>[];
}

interface SubSchemaChange {
  path: string[];
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

export class $SchemaChangeListener extends EventEmitter {

  private mapping = new Map<string, Map<string, FieldMapping>>();

  reset() {
    this.mapping.clear();
  }

  clearSchemaDependency(cls: Class) {
    this.mapping.delete(id(cls));
  }

  trackSchemaDependency(src: Class, parent: Class, path: string[], config: ClassConfig) {
    const _id = id(src);
    if (!this.mapping.has(_id)) {
      this.mapping.set(_id, new Map());
    }
    this.mapping.get(_id)!.set(id(parent), { path, config });
  }

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
        updates.get(depClsId)!.subs.push({ path: c.path, fields: changes });
      }
    }

    for (const key of updates.keys()) {
      this.emit(SCHEMA_CHANGE_EVENT, {
        cls: updates.get(key)!.config.class,
        change: updates.get(key)!
      } as SchemaChangeEvent);
    }
  }

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

    for (const c of currFields) {
      if (prevFields.has(c)) {
        const prevSchema = prevView.schema[c];
        const currSchema = currView.schema[c];
        if (JSON.stringify(prevSchema) !== JSON.stringify(currSchema) || prevSchema.type !== currSchema.type) {
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