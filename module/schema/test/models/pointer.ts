import { SchemaTypeUtil } from '@travetto/schema';

/**
 * @concrete #SpecialTypeTarget
 */
export type SpecialType = string | number | true;

export class SpecialTypeTarget { }

SchemaTypeUtil.setSchemaTypeConfig(SpecialTypeTarget, {
  validate(input: unknown) {
    console.log('Validating schema', { input });
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
  },
  bind(input: unknown) {
    return input;
  }
});
