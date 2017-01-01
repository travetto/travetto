import { enumKeys } from '../util';
import { ClsList, ModelRegistry } from '../service/registry';
import 'reflect-metadata';

function prop(obj: { [key: string]: any }) {
  return (f: any, prop: string) => {
    ModelRegistry.registerFieldFacet(f, prop, obj);
  };
}

export function Field(type: ClsList) {
  return (f: any, prop: string) => {
    ModelRegistry.registerFieldFacet(f, prop, ModelRegistry.buildFieldConfig(type));
  };
}

export const Required = () => prop({ required: true });
export const Enum = (vals: string[] | any) => prop({ enum: Array.isArray(vals) ? vals : enumKeys(vals) });
export const Trimmed = () => prop({ trim: true });
export const Match = (re: RegExp) => prop({ regExp: re });
export const MinLength = (n: number) => prop({ minlength: n });
export const MaxLength = (n: number) => prop({ maxlength: n });
export const Min = (n: number | Date) => prop({ min: n });
export const Max = (n: number | Date) => prop({ max: n });

export function View(...names: string[]) {
  return (f: any, prop: string) => {
    for (let name of names) {
      ModelRegistry.registerFieldFacet(f, prop, {}, name);
    }
  };
}
