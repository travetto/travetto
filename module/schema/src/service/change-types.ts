import { Class } from '@travetto/runtime';
import { ChangeEvent } from '@travetto/registry';

import { SchemaFieldConfig, SchemaClassConfig, SchemaMethodConfig } from './types';

export interface FieldMapping {
  path: SchemaFieldConfig[];
  config: SchemaClassConfig;
}

export interface SubSchemaChangeEvent {
  cls: Class;
  fieldChanges: ChangeEvent<SchemaFieldConfig>[];
  methodChanges: ChangeEvent<SchemaMethodConfig>[];
}

export interface SubSchemaChange {
  path: SchemaFieldConfig[];
  fields: ChangeEvent<SchemaFieldConfig>[];
  methods: ChangeEvent<SchemaMethodConfig>[];
}

export interface SchemaChange {
  config: SchemaClassConfig;
  subs: SubSchemaChange[];
}

export interface SchemaChangeEvent {
  cls: Class;
  change: SchemaChange;
}