import { ObjectUtil } from '@encore/util';
import { SchemaRegistry, ClsList } from '../service';
import { Re } from '../util';
import { Messages } from '../util';

function prop(obj: { [key: string]: any }) {
  return (f: any, p: string) => {
    SchemaRegistry.registerFieldFacet(f, p, obj);
  };
}

function enumKeys(c: any): string[] {
  if (Array.isArray(c) && typeof c[0] === 'string') {
    return c;
  } else {
    return ObjectUtil.values(c).filter((x: any) => typeof x === 'string') as string[];
  }
}
export function Field(type: ClsList, config?: { [key: string]: any }) {
  return (f: any, p: string) => {
    SchemaRegistry.registerFieldConfig(f, p, type);
    if (config) {
      SchemaRegistry.registerFieldFacet(f, p, config);
    }
  };
};
export const Alias = (...aliases: string[]) => prop({ aliases });
export const Required = (message?: string) => prop({ required: [true, message || Messages.REQUIRED] });
export const Enum = (vals: string[] | any, message?: string) => {
  let values = enumKeys(vals);
  message = message || `{PATH} is only allowed to be "${values.join('" or "')}"`;
  return prop({ enum: { values, message } });
};
export const Trimmed = () => prop({ trim: true });
export const Match = (re: RegExp, message?: string) => prop({ match: [re, message || (re as any).message] });
export const MinLength = (n: number, message?: string) => prop({ minlength: [n, message || Messages.MINLENGTH] });
export const MaxLength = (n: number, message?: string) => prop({ maxlength: [n, message || Messages.MAXLENGTH] });
export const Min = (n: number | Date, message?: string) => prop({ min: [n, message || Messages.MIN] });
export const Max = (n: number | Date, message?: string) => prop({ max: [n, message || Messages.MAX] });
export const Email = (message?: string) => Match(Re.EMAIL, message);
export const Telephone = (message?: string) => Match(Re.TELEPHONE, message);
export const Url = (message?: string) => Match(Re.URL, message);

export function View(...names: string[]) {
  return (f: any, p: string) => {
    for (let name of names) {
      SchemaRegistry.registerFieldFacet(f, p, {}, name);
    }
  };
}