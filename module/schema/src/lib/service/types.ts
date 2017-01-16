export interface Cls<T> {
  new (...args: any[]): T;
  name: string;
}

export type ClsList = Cls<any> | [Cls<any>];

export interface ViewConfig {
  schema: { [key: string]: FieldConfig };
  fields: string[];
}

export interface ClassConfig {
  finalized: boolean;
  metadata: { [key: string]: any };
  views: { [key: string]: ViewConfig };
}

export interface FieldConfig {
  type: any;
  name: string;
  aliases?: string[];
  declared: { type: Cls<any>, array: boolean };
}