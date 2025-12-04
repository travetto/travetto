import { TypedObject } from '@travetto/runtime';

/**
 * List of common regular expressions for fields
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const [CommonRegex, CommonRegexToName] = (() => {
  const regexToName = new Map<RegExp, string>();
  const regexes = {
    email: /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
    telephone: /^(\+?\d{1,3}(\s*-?\s*|\s+))?((\(\d{3}\))|\d{3})(\s*|-|[.])(\d{3})(\s*|-|[.])(\d{4})(\s+(x|ext[.]?)\s*\d+)?$/,
    url: /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/,
    simpleName: /^([a-zA-Z\u0080-\u024F]{0,100}(?:. |-| |')){0,10}[a-zA-Z\u0080-\u024F]+$/,
    postalCode: /^\d{5}(?:[-\s]\d{4})?$/
  };
  // Rebind regexes
  for (const key of TypedObject.keys(regexes)) {
    const name = `[[:${key}:]]`;
    regexToName.set(regexes[key], name);
  }
  return [regexes, regexToName];
})();