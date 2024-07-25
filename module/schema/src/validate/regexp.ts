import { TypedObject } from '@travetto/runtime';
import { Messages } from './messages';

declare global {
  interface RegExp {
    name?: string;
  }
}

/**
 * List of common regular expressions for fields
 */
export const CommonRegExp = {
  email: /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
  telephone: /^(\+?\d{1,3}(\s*-?\s*|\s+))?((\(\d{3}\))|\d{3})(\s*|-|[.])(\d{3})(\s*|-|[.])(\d{4})(\s+(x|ext[.]?)\s*\d+)?$/,
  url: /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/,
  simpleName: /^([a-zA-Z\u0080-\u024F]*(?:. |-| |'))*[a-zA-Z\u0080-\u024F]+$/,
  postalCode: /^\d{5}(?:[-\s]\d{4})?$/
};

// Rebind regexes
for (const k of TypedObject.keys(CommonRegExp)) {
  CommonRegExp[k].name = `[[:${k}:]]`;
  Messages.set(CommonRegExp[k].name!, Messages.get(k)!);
}