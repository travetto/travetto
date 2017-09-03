import { FieldConfig } from '../service';

export const Messages = new Map<any, string>(Object.entries({
  required: '{PATH} is required',
  minlength: '{PATH} is not long enough ({MINLENGTH})',
  maxlength: '{PATH} is too long ({MAXLENGTH})',
  min: '{PATH} is not greater than ({MIN})',
  max: '{PATH} is bigger than ({MAX})',
  telephone: '{PATH} is not a valid phone number',
  url: '{PATH} is not a valid url',
  simple_name: '{PATH} is not a proper name',
  postal_code: '{PATH} is not a valid postal code',
  email: '{PATH} is not a valid email address'
}));