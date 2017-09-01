import { Messages } from './messages';

function build(re: RegExp, message?: string) {
  (re as any).message = message;
  return re;
}

export class Re {
  static EMAIL = build(/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/, Messages.EMAIL);
  static TELEPHONE = build(/^(\+?\d{1,3}(\s*-?\s*|\s+))?((\(\d{3}\))|\d{3})(\s*|-|[.])(\d{3})(\s*|-|[.])(\d{4})(\s+(x|ext[.]?)\s*\d+)?$/, Messages.TELEPHONE);
  static URL = build(/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/, Messages.URL);
  static SIMPLE_NAME = build(/^([a-zA-Z\u0080-\u024F]*(?:. |-| |'))*[a-zA-Z\u0080-\u024F]+$/, Messages.SIMPLE_NAME);
  static POSTAL_CODE = build(/^\d{5}(?:[-\s]\d{4})?$/, Messages.POSTAL_CODE);
}