import { Messages } from './messages';

export const CommonRegExp = {
  email: /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
  telephone: /^(\+?\d{1,3}(\s*-?\s*|\s+))?((\(\d{3}\))|\d{3})(\s*|-|[.])(\d{3})(\s*|-|[.])(\d{4})(\s+(x|ext[.]?)\s*\d+)?$/,
  url: /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/,
  simple_name: /^([a-zA-Z\u0080-\u024F]*(?:. |-| |'))*[a-zA-Z\u0080-\u024F]+$/,
  postal_code: /^\d{5}(?:[-\s]\d{4})?$/
};

// Rebind regexes
for (const k of Object.keys(CommonRegExp) as (keyof typeof CommonRegExp)[]) {
  Object.defineProperty(CommonRegExp[k], 'source', { value: `[[:${k}:]]` });
  Messages.set((CommonRegExp as any)[k], Messages.get(k)!);
}