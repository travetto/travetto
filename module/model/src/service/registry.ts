import { SchemaRegistry, ClassConfig, FieldConfig } from '@travetto/schema';
import { ModelOptions } from './types';
import { EventEmitter } from 'events';
import { MetadataRegistry, Class, ChangeEvent } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { AppEnv } from '@travetto/base';

type ModelChanges = { path: string[], changes: ChangeEvent<FieldConfig>[] }[];
export type SchemaChangeEvent = { cls: Class, changes: ModelChanges };

export class $ModelRegistry extends MetadataRegistry<ModelOptions<any>> {
  private schemaDependencies = new Map<string, Map<string, string[]>>();

  constructor() {
    super(SchemaRegistry, DependencyRegistry);

    SchemaRegistry.onFieldChange(this.trackSchemaChanges.bind(this));
  }

  trackSchemaChanges({ cls, changes }: { cls: Class, changes: ChangeEvent<FieldConfig>[] }) {
    const updates = new Map<string, ModelChanges>();

    if (this.schemaDependencies.has(cls.__id)) {
      const deps = this.schemaDependencies.get(cls.__id)!;
      for (const id of deps.keys()) {
        if (!updates.has(id)) {
          updates.set(id, []);
        }
        const path = deps.get(id)!;
        updates.get(id)!.push({ path, changes });
      }
    }

    for (const key of updates.keys()) {
      this.events.emit('model:schema-change', {
        cls: SchemaRegistry.get(key).class,
        delta: updates.get(key)!
      });
    }
  }

  onSchemaChange(cb: (ev: { cls: Class, changes: ModelChanges }) => void) {
    this.events.on('model:schema-change', cb);
  }

  trackSchemaDependencies(cls: Class, curr: Class = cls, path: string[] = []) {
    const config = SchemaRegistry.get(curr);

    // Store current value as mapping
    if (!this.schemaDependencies.has(curr.__id)) {
      this.schemaDependencies.set(curr.__id, new Map());
    }
    this.schemaDependencies.get(curr.__id)!.set(cls.__id, path);

    // Read children
    const view = config.views[SchemaRegistry.DEFAULT_VIEW];
    for (const k of view.fields) {
      if (SchemaRegistry.has(view.schema[k].declared.type)) {
        this.trackSchemaDependencies(cls, view.schema[k].declared.type, [...path, k]);
      }
    }
  }

  createPending(cls: Class) {
    return { class: cls };
  }

  onInstallFinalize<T>(cls: Class<T>) {
    if (AppEnv.watch) {
      this.trackSchemaDependencies(cls);
    }
    return this.pending.get(cls.__id)! as ModelOptions<T>;
  }

  onUninstallFinalize<T>(cls: Class<T>) {
    super.onUninstallFinalize(cls);
    this.schemaDependencies.delete(cls.__id);
  }
}

export const ModelRegistry = new $ModelRegistry();