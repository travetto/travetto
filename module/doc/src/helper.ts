import * as n from './nodes';
import { AllChildren } from './render';

export function doc(values: TemplateStringsArray, ...keys: (AllChildren | { ᚕfile: string, name: string } | string)[]) {
  const out: AllChildren[] = [];

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

export function inp(values: TemplateStringsArray) {
  return n.Input(values[0]);
}

export function pth(values: TemplateStringsArray) {
  return n.Path(values[0]);
}

export function fld(values: TemplateStringsArray) {
  return n.Field(values[0]);
}

export function cls(values: TemplateStringsArray) {
  return n.Class(values[0]);
}

export function meth(values: TemplateStringsArray) {
  return n.Method(values[0]);
}
