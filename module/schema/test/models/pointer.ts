/**
 * @concrete SpecialType
 */
export type SpecialType = string | number | true;
export const SpecialType = class SpecialType {
  static validateSchema(input: any) {
    console.log('Validating schema', input);
    if (input !== undefined) {
      switch (typeof input) {
        case 'boolean': {
          if (input === false) {
            return 'type';
          }
          return;
        }
        case 'number': {
          if (input > 100) {
            return 'maxlength';
          }
          return;
        }
        case 'string': return;
        default:
          return 'type';
      }
    }
  }
  static bindSchema(input: any) {
    return input;
  }
};