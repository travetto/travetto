export interface SchemaInst {
  _type?: string;
}

export interface SchemaCls<T extends SchemaInst> {
  new (...args: any[]): T;
  name: string;
  alternateName?: string;
}

export type SchemaClsList = SchemaCls<any> | [SchemaCls<any>];

export interface SchemaConfig {
  name: string;
  discriminated: { [key: string]: SchemaCls<any> };
  views: {
    [key: string]: {
      schema: { [key: string]: FieldCfg },
      fields: string[]
    }
  };
}

export interface FieldCfg {
  type: any;
  declared: { type: SchemaCls<any>, array: boolean };
}