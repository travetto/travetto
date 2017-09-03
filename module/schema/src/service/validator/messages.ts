export const Messages = new Map<any, string>(Object.entries({
  required: '{path} is required',
  minlength: '{path} is not long enough {minlength}',
  maxlength: '{path} is too long {maxlength}',
  min: '{path} is not greater than (min}: {value}',
  max: '{path} is bigger than {max}: {value}',
  telephone: '{path} is not a valid phone number',
  url: '{path} is not a valid url',
  simple_name: '{path} is not a proper name',
  postal_code: '{path} is not a valid postal code',
  email: '{path} is not a valid email address'
}));