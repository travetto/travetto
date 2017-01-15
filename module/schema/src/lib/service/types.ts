export interface Cls<T> {
  new (...args: any[]): T;
  name: string;
}

export type ClsList = Cls<any> | [Cls<any>];

export interface ClassConfig {
  name: string;
  parent?: string;
  discriminator?: string;
  metadata: any;
  subtypes: { [key: string]: Cls<any> };
  views: {
    [key: string]: {
      schema: { [key: string]: FieldConfig },
      fields: string[]
    }
  };
}

export interface FieldConfig {
  type: any;
  metadata: any;
  declared: { type: Cls<any>, array: boolean };
}