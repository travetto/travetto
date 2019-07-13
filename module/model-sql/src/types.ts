import { VisitStack } from './util';

export interface InsertWrapper {
  stack: VisitStack[];
  records: { stack: VisitStack[], value: any }[];
}

export interface DeleteWrapper {
  stack: VisitStack[];
  ids: string[];
}
