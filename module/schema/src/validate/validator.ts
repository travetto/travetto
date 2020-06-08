import { Class } from '@travetto/registry';

import { FieldConfig, SchemaConfig } from '../service/types';
import { SchemaRegistry } from '../service/registry';
import { ValidationError, ValidationKind, ValidationResult } from './types';
import { Messages } from './messages';
import { ValidationResultError } from './error';

/**
 * Get the schema config for Class/Schema config, including support for polymorphism
 * @param base The starting type or config
 * @param o The value to use for the polymorphic check
 */
function resolveSchema<T>(base: Class<T> | SchemaConfig, o: T) {
  if (base.__id) {
    return SchemaRegistry.getViewSchema(
      SchemaRegistry.resolveSubTypeForInstance(base as Class<T>, o), undefined).schema;
  } else {
    return base as SchemaConfig;
  }
}

/**
 * Get the constructor for a class
 */
// @ts-ignore
const getClass = <T>(o: T) => o.constructor as Class<T>;

/**
 * The schema validator applies the schema constraints to a given object and looks
 * for errors
 */
export class SchemaValidator {

  /**
   * Validate the schema for a given object
   * @param schema The config to validate against
   * @param o The object to validate
   * @param relative The relative path as the validation recurses
   */
  private static validateSchema<T>(schema: SchemaConfig, o: T, relative: string) {
    let errors: ValidationError[] = [];

    for (const field of Object.keys(schema)) {
      const fieldSchema = schema[field];
      // @ts-ignore
      const val = o[field];
      const path = `${relative}${relative && '.'}${field}`;

      const hasValue = !(val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0));

      if (!hasValue) {
        if (fieldSchema.required && fieldSchema.required.active) {
          errors.push(...this.prepareErrors(path, [{ kind: 'required', ...fieldSchema.required }]));
        }
        continue;
      }

      const { type, array } = fieldSchema;
      const complex = SchemaRegistry.has(type) || type === Object;

      if (array) {
        if (!Array.isArray(val)) {
          errors = errors.concat(this.prepareErrors(path, [{ kind: 'type', type: Array, value: val }]));
          continue;
        }
        if (complex) {
          for (let i = 0; i < val.length; i++) {
            const subErrors = this.validateSchema(resolveSchema(type, val[i]), val[i], `${path}[${i}]`);
            errors = errors.concat(subErrors);
          }
        } else {
          for (let i = 0; i < val.length; i++) {
            const subErrors = this.validateField(fieldSchema, val[i], o);
            errors.push(...this.prepareErrors(`${path}[${i}]`, subErrors));
          }
        }
      } else if (complex) {
        const subErrors = this.validateSchema(resolveSchema(type, val), val, path);
        errors.push(...subErrors);
      } else {
        const fieldErrors = this.validateField(fieldSchema, val, o);
        errors.push(...this.prepareErrors(path, fieldErrors));
      }
    }

    return errors;
  }

  /**
   * Validate the range for a number, date
   * @param field The config to validate against
   * @param key The bounds to check
   * @param value The value to validate
   */
  static validateRange(field: FieldConfig, key: 'min' | 'max', value: any) {
    const f = field[key]!;
    if (typeof f.n === 'number') {
      if (typeof value !== 'number') {
        value = parseInt(value, 10);
      }
      if (field.type === Date) {
        value = new Date(value);
      }
      if (key === 'min' && value < f.n || key === 'max' && value > f.n) {
        return true;
      }
    } else {
      const date = f.n.getTime();
      if (typeof value === 'string') {
        value = Date.parse(value);
      }
      if (key === 'min' && value < date || key === 'max' && value > date) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validate a given field by checking all the appropriate constraints
   *
   * @param field The config of the field to validate
   * @param value The actual value
   */
  static validateField(field: FieldConfig, value: any, parent: any): ValidationResult[] {
    const criteria: ValidationKind[] = [];

    if (
      (field.type === String && (typeof value !== 'string')) ||
      (field.type === Number && ((typeof value !== 'number') || Number.isNaN(value))) ||
      (field.type === Date && (!(value instanceof Date) || Number.isNaN(value.getTime()))) ||
      (field.type === Boolean && typeof value !== 'boolean')
    ) {
      criteria.push('type');
      return [{ kind: 'type', type: field.type.name.toLowerCase() }];
    }

    if (field.type.validateSchema) {
      const kind = field.type.validateSchema(value);
      switch (kind) {
        case undefined: break;
        case 'type': return [{ kind, type: field.type.name }];
        default:
          criteria.push(kind as 'type');
      }
    }

    if (field.match && !field.match.re.test(`${value}`)) {
      criteria.push('match');
    }

    if (field.minlength && `${value}`.length < field.minlength.n) {
      criteria.push('minlength');
    }

    if (field.maxlength && `${value}`.length > field.maxlength.n) {
      criteria.push('maxlength');
    }

    if (field.enum && !field.enum.values.includes(value)) {
      criteria.push('enum');
    }

    if (field.min && this.validateRange(field, 'min', value)) {
      criteria.push('min');
    }

    if (field.max && this.validateRange(field, 'max', value)) {
      criteria.push('max');
    }

    const errors: ValidationResult[] = [];
    for (const key of criteria) {
      const block = field[key as keyof FieldConfig];
      // @ts-expect-error
      errors.push({ ...block, kind: key, value });
    }

    return errors;
  }

  /**
   * Convert validation results into proper errors
   * @param path The object path
   * @param results The list of results for that specific path
   */
  static prepareErrors(path: string, results: ValidationResult[]): ValidationError[] {
    const out: ValidationError[] = [];
    for (const res of results) {
      const err: Partial<ValidationError> = {
        ...(res as ValidationError),
        path
      };

      const msg = res.message ||
        (res.re && Messages.get(res.re)) ||
        Messages.get(res.kind) ||
        Messages.get('default')!;

      if (res.re) {
        err.re = res.re.source;
      }

      err.message = msg
        .replace(/\{([^}]+)\}/g, (a: string, k: string) => err[k as (keyof ValidationError)]!);

      out.push(err as ValidationError);
    }
    return out;
  }

  /**
   * Validate an object against it's constructor's schema
   * @param o The object to validate
   * @param view The optional view to limit the scope to
   */
  static async validate<T>(o: T, view?: string): Promise<T> {
    let cls = getClass(o);
    cls = SchemaRegistry.resolveSubTypeForInstance(cls, o);

    const config = SchemaRegistry.getViewSchema(cls, view);
    const validators = SchemaRegistry.get(cls).validators;

    // Validate using standard behaviors
    const errors = this.validateSchema(config.schema, o, '');

    // Handle class level validators
    for (const fn of validators) {
      try {
        const res = await fn(o, view);
        if (res) {
          errors.push(res);
        }
      } catch (err) {
        errors.push(err);
      }
    }

    if (errors.length) {
      throw new ValidationResultError(errors);
    }

    return o;
  }

  /**
   * Validate an entire array of values
   * @param obj The values to validate
   * @param view The view to limit by
   */
  static async validateAll<T>(obj: T[], view?: string): Promise<T[]> {
    return await Promise.all<T>((obj ?? [])
      .map(o => this.validate(o, view)));
  }

  /**
   * Validate partial, ignoring required fields as they are partial
   *
   * @param o The value to validate
   * @param view The view to limit by
   */
  static async validatePartial<T>(o: T, view?: string): Promise<T> {
    try {
      await this.validate(o, view);
    } catch (e) {
      if (e instanceof ValidationResultError) { // Don't check required fields
        const errs = e.errors.filter(x => x.kind !== 'required');
        if (errs.length) {
          e.errors = errs;
          throw e;
        }
      }
    }
    return o;
  }
}