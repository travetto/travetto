export interface Cls<T> {
  new (...args: any[]): T;
  name: string;
}

export type ClsList = Cls<any> | [Cls<any>];

export interface ClassConfig {
  name: string;
  metadata: { [key: string]: any };
  views: {
    [key: string]: {
      schema: { [key: string]: FieldConfig },
      fields: string[]
    }
  };
}

export interface FieldConfig {
  type: any;
  declared: { type: Cls<any>, array: boolean };
}