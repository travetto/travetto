// TODO: Document
// TODO: Move?
export const Messages = new Map<any, string>(Object.entries({
  default: '{path} is not valid',
  type: '{path} is not a valid {type}',
  required: '{path} is required',
  minlength: '{path} is not long enough ({n})',
  maxlength: '{path} is too long ({n})',
  match: '{path} should match {re}',
  min: '{path} is not greater than ({n})',
  max: '{path} is bigger than ({n})',
  telephone: '{path} is not a valid phone number',
  url: '{path} is not a valid url',
  simpleName: '{path} is not a proper name',
  postalCode: '{path} is not a valid postal code',
  email: '{path} is not a valid email address'
}));