import { TypedObject } from '@travetto/runtime';
import { Messages } from './messages.ts';

/**
 * List of common regular expressions for fields
 */
export const CommonRegExp = {
  email: /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
  telephone: /^(\+?\d{1,3}(\s*-?\s*|\s+))?((\(\d{3}\))|\d{3})(\s*|-|[.])(\d{3})(\s*|-|[.])(\d{4})(\s+(x|ext[.]?)\s*\d+)?$/,
  url: /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/,
  simpleName: /^([a-zA-Z\u0080-\u024F]{0,100}(?:. |-| |')){0,10}[a-zA-Z\u0080-\u024F]+$/,
  postalCode: /^\d{5}(?:[-\s]\d{4})?$/
};

export const CommonRegExpToName = new Map<RegExp, string>();

// Rebind regexes
for (const key of TypedObject.keys(CommonRegExp)) {
  const name = `[[:${key}:]]`;
  CommonRegExpToName.set(CommonRegExp[key], name);
  Messages.set(name, Messages.get(key)!);
}