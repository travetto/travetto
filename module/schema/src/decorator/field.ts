import { CommonRegExp, SchemaRegistry, ClassList } from '../service';

function prop(obj: { [key: string]: any }) {
  return (f: any, p: string) => {
    SchemaRegistry.registerPendingFieldFacet(f, p, obj);
  };
}

function enumKeys(c: any): string[] {
  if (Array.isArray(c) && typeof c[0] === 'string') {
    return c;
  } else {
    return Object.values(c).filter((x: any) => typeof x === 'string') as string[];
  }
}
export function Field(type: ClassList, config?: { [key: string]: any }) {
  return (f: any, p: string) => {
    SchemaRegistry.registerPendingFieldConfig(f, p, type);
    if (config) {
      SchemaRegistry.registerPendingFieldFacet(f, p, config);
    }
  };
};
export const Alias = (...aliases: string[]) => prop({ aliases });
export const Required = (message?: string) => prop({ required: { message } });
export const Enum = (vals: string[] | any, message?: string) => {
  let values = enumKeys(vals);
  message = message || `{path} is only allowed to be "${values.join('" or "')}"`;
  return prop({ enum: { values, message } });
};
export const Trimmed = () => prop({ trim: true });
export const Match = (re: RegExp, message?: string) => prop({ match: { re, message } });
export const MinLength = (n: number, message?: string) => prop({ minlength: { n, message } });
export const MaxLength = (n: number, message?: string) => prop({ maxlength: { n, message } });
export const Min = (n: number | Date, message?: string) => prop({ min: { n, message } });
export const Max = (n: number | Date, message?: string) => prop({ max: { n, message } });
export const Email = (message?: string) => Match(CommonRegExp.email, message);
export const Telephone = (message?: string) => Match(CommonRegExp.telphone, message);
export const Url = (message?: string) => Match(CommonRegExp.url, message);

export function View(...names: string[]) {
  return (f: any, p: string) => {
    for (let name of names) {
      SchemaRegistry.registerPendingFieldFacet(f, p, {}, name);
    }
  };
}

// For Auto schemas
export function Ignore(): PropertyDecorator {
  return (target: any, property: string) => { }
}
