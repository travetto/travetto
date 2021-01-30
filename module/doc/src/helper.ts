import * as n from './nodes';
import { AllType } from './node-types';

export function doc(values: TemplateStringsArray, ...keys: (AllType | { ᚕfile: string, name: string } | string)[]) {
  const out: AllType[] = [];

  keys.forEach((el, i) =>
    out.push(
      n.Text(values[i] ?? ''),
      typeof el === 'string' ?
        n.Text(el) :
        'ᚕfile' in el ? n.Ref(el.name, el.ᚕfile) : el
    )
  );

  if (values.length > keys.length) {
    out.push(n.Text(values[values.length - 1]));
  }
  return out.length === 1 ? out[0] : n.Group(out);
}

export const inp = (values: TemplateStringsArray) => n.Input(values[0]);
export const pth = (values: TemplateStringsArray) => n.Path(values[0]);
export const fld = (values: TemplateStringsArray) => n.Field(values[0]);
export const cls = (values: TemplateStringsArray) => n.Class(values[0]);
export const meth = (values: TemplateStringsArray) => n.Method(values[0]);