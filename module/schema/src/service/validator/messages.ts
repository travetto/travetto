export const Messages = new Map<any, string>(Object.entries({
  required: '{path} is required',
  minlength: '{path} is not long enough ({n})',
  maxlength: '{path} is too long ({n})',
  min: '{path} is not greater than ({n})',
  max: '{path} is bigger than ({n})',
  telephone: '{path} is not a valid phone number',
  url: '{path} is not a valid url',
  simple_name: '{path} is not a proper name',
  postal_code: '{path} is not a valid postal code',
  email: '{path} is not a valid email address'
}));