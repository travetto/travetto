
export interface Class<T = any> {
  new(...args: any[]): T;
  from?: <Z>(data: any) => Z;
  name: string;
}

export type ClassList = Class | [Class];

export interface ViewConfig {
  schema: { [key: string]: FieldConfig };
  fields: string[];
}

export interface ClassConfig {
  views: { [key: string]: ViewConfig };
}

export interface FieldConfig {
  type: any;
  name: string;
  aliases?: string[];
  validator?: (o: any) => string[] | undefined;
  declared: { type: Class<any>, array: boolean };
}

