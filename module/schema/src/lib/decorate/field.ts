import { enumKeys } from '../util';
import { SchemaRegistry, SchemaClsList } from '../service';
import 'reflect-metadata';

function prop(obj: { [key: string]: any }) {
  return (f: any, prop: string) => {
    SchemaRegistry.registerFieldFacet(f, prop, obj);
  };
}

export function Field(type: SchemaClsList) {
  return (f: any, prop: string) => {
    SchemaRegistry.registerFieldFacet(f, prop, SchemaRegistry.buildFieldConfig(type));
  };
}

export const Required = () => prop({ required: true });
export const Enum = (vals: string[] | any, message?: string) => prop({
  enum: {
    values: Array.isArray(vals) ? vals : enumKeys(vals),
    message
  }
});
export const Trimmed = () => prop({ trim: true });
export const Match = (re: RegExp, message?: string) => prop({ match: [re, message] });
export const MinLength = (n: number, message?: string) => prop({ minlength: [n, message] });
export const MaxLength = (n: number, message?: string) => prop({ maxlength: [n, message] });
export const Min = (n: number | Date, message?: string) => prop({ min: [n, message] });
export const Max = (n: number | Date, message?: string) => prop({ max: [n, message] });
export const Email = (message?: string) => Match(/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/, message);
export const Telephone = (message?: string) => Match(/^(\+?\d{1,3}\s+)?((\(\d{3}\))|\d{3})(\s*|-|[.])(\d{3})(\s*|-|[.])(\d{4})(\s+(x|ext[.]?)\s*\d+)?$/, message);
export const Url = (message?: string) => Match(/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/, message);

export function View(...names: string[]) {
  return (f: any, prop: string) => {
    for (let name of names) {
      SchemaRegistry.registerFieldFacet(f, prop, {}, name);
    }
  };
}
