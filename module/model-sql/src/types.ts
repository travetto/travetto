import { type Class } from '@travetto/runtime';

export const TableSymbol = Symbol.for('@travetto/model-sql:table');

export type VisitStack = {
  [TableSymbol]?: string;
  array?: boolean;
  type: Class;
  name: string;
  index?: number;
};
