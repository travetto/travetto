export class Re {
  static EMAIL = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  static TELEPHONE = /^(\+?\d{1,3}(\s*-?\s*|\s+))?((\(\d{3}\))|\d{3})(\s*|-|[.])(\d{3})(\s*|-|[.])(\d{4})(\s+(x|ext[.]?)\s*\d+)?$/;
  static URL = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/;
  static SIMPLE_NAME = /^([a-zA-Z\u0080-\u024F]+(?:. |-| |'))*[a-zA-Z\u0080-\u024F]*$/;
  static POSTAL_CODE = /^\d{5}(?:[-\s]\d{4})?$/;
}
