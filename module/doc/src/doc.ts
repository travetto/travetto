import { AllType, node } from './nodes';

export function doc(values: TemplateStringsArray, ...keys: (AllType | Function | string)[]): AllType {
  const out: AllType[] = [];

  keys.forEach((el, i) =>
    out.push(
      node.Text(values[i] ?? ''),
      typeof el === 'string' ?
        node.Text(el) :
        typeof el === 'function' ? node.Ref(el.name, el) : el
    )
  );

  if (values.length > keys.length) {
    out.push(node.Text(values[values.length - 1]));
  }
  return out.length === 1 ? out[0] : node.Group(out);
}

Object.assign(doc, node);

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const d = doc as (typeof doc) & (typeof node);