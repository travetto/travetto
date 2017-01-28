function build(re: RegExp, message?: string) {
  (re as any).message = message;
  return re;
}

export class Re {
  static EMAIL = build(/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/, '{PATH} is not a valid email address');
  static TELEPHONE = build(/^(\+?\d{1,3}(\s*-?\s*|\s+))?((\(\d{3}\))|\d{3})(\s*|-|[.])(\d{3})(\s*|-|[.])(\d{4})(\s+(x|ext[.]?)\s*\d+)?$/, '{PATH} is not a valid phone number');
  static URL = build(/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/, '{PATH} is not a valid url');
  static SIMPLE_NAME = build(/^([a-zA-Z\u0080-\u024F]*(?:. |-| |'))*[a-zA-Z\u0080-\u024F]+$/, '{PATH} is not a proper name');
  static POSTAL_CODE = build(/^\d{5}(?:[-\s]\d{4})?$/, '{PATH} is not a valid postal code');
}