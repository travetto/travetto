/**
 * List of validation messages
 */
export const Messages = new Map<string, string>(Object.entries({
  default: '{path} is not valid',
  type: '{path} is not a valid {type}',
  required: '{path} is required',
  minlength: '{path} is not long enough ({limit})',
  maxlength: '{path} is too long ({limit})',
  match: '{path} should match {regex}',
  min: '{path} is less than ({limit})',
  max: '{path} is greater than ({limit})',
  '[[:telephone:]]': '{path} is not a valid phone number',
  '[[:url:]]': '{path} is not a valid url',
  '[[:simpleName:]]': '{path} is not a proper name',
  '[[:postalCode:]]': '{path} is not a valid postal code',
  '[[:email:]]': '{path} is not a valid email address'
}));