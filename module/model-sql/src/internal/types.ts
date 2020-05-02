import { FieldConfig } from '@travetto/schema';
import { VisitStack } from './util';

export interface InsertWrapper {
  stack: VisitStack[];
  records: { stack: VisitStack[], value: any }[];
}

export interface DeleteWrapper {
  stack: VisitStack[];
  ids: string[];
}

export interface DialectState {
  pathField: FieldConfig;
  parentPathField: FieldConfig;
  idField: FieldConfig;
  idxField: FieldConfig;
}