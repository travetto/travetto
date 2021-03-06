import { Class, ClassInstance, Util } from '@travetto/base';

import { FieldConfig, SchemaConfig } from '../service/types';
import { SchemaRegistry } from '../service/registry';
import { ValidationError, ValidationKind, ValidationResult } from './types';
import { Messages } from './messages';
import { TypeMismatchError, ValidationResultError } from './error';

/**
 * Get the schema config for Class/Schema config, including support for polymorphism
 * @param base The starting type or config
 * @param o The value to use for the polymorphic check
 */
function resolveSchema<T>(base: Class<T>, o: T, view?: string) {
  return SchemaRegistry.getViewSchema(
    SchemaRegistry.resolveSubTypeForInstance(base, o), view).schema;
}

declare global {
  interface RegExp {
    name?: string;
  }
}

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
  static #validateSchema<T>(schema: SchemaConfig, o: T, relative: string) {
    let errors: ValidationError[] = [];

    for (const field of Object.keys(schema)) {
      if (schema[field].access !== 'readonly') { // Do not validate readonly fields
        errors = errors.concat(this.#validateFieldSchema(schema[field], o[field as keyof T], relative));
      }
    }

    return errors;
  }

  /**
   * Validate a single field config against a passed in value
   * @param fieldSchema The field schema configuration
   * @param val The raw value, could be an array or not
   * @param relative The relative path of object traversal
   */
  static #validateFieldSchema(fieldSchema: FieldConfig, val: unknown, relative: string = '') {
    const path = `${relative}${relative && '.'}${fieldSchema.name}`;

    const hasValue = !(val === undefined || val === null || (typeof val === 'string' && val === '') || (Array.isArray(val) && val.length === 0));

    if (!hasValue) {
      if (fieldSchema.required && fieldSchema.required.active) {
        return this.#prepareErrors(path, [{ kind: 'required', ...fieldSchema.required }]);
      } else {
        return [];
      }
    }

    const { type, array, view } = fieldSchema;
    const complex = SchemaRegistry.has(type);

    if (type === Object) {
      return [];
    } else if (array) {
      if (!Array.isArray(val)) {
        return this.#prepareErrors(path, [{ kind: 'type', type: Array, value: val }]);
      }
      let errors: ValidationError[] = [];
      if (complex) {
        for (let i = 0; i < val.length; i++) {
          const subErrors = this.#validateSchema(resolveSchema(type, val[i], view), val[i], `${path}[${i}]`);
          errors = errors.concat(subErrors);
        }
      } else {
        for (let i = 0; i < val.length; i++) {
          const subErrors = this.#validateField(fieldSchema, val[i]);
          errors.push(...this.#prepareErrors(`${path}[${i}]`, subErrors));
        }
      }
      return errors;
    } else if (complex) {
      return this.#validateSchema(resolveSchema(type, val, view), val, path);
    } else {
      const fieldErrors = this.#validateField(fieldSchema, val);
      return this.#prepareErrors(path, fieldErrors);
    }
  }

  /**
   * Validate the range for a number, date
   * @param field The config to validate against
   * @param key The bounds to check
   * @param value The value to validate
   */
  static #validateRange(field: FieldConfig, key: 'min' | 'max', value: string | number | Date) {
    const f = field[key]!;
    if (typeof f.n === 'number') {
      if (typeof value !== 'number') {
        value = parseInt(value as string, 10);
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
  static #validateField(field: FieldConfig, value: unknown): ValidationResult[] {
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

    if (field.type?.validateSchema) {
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

    if (field.enum && !field.enum.values.includes(value as string)) {
      criteria.push('enum');
    }

    if (field.min && this.#validateRange(field, 'min', value as number)) {
      criteria.push('min');
    }

    if (field.max && this.#validateRange(field, 'max', value as number)) {
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
  static #prepareErrors(path: string, results: ValidationResult[]): ValidationError[] {
    const out: ValidationError[] = [];
    for (const res of results) {
      const err: Partial<ValidationError> = {
        ...(res as ValidationError),
        path
      };

      const msg = res.message ??
        Messages.get(res.re?.name ?? res.re?.source ?? '') ??
        Messages.get(res.kind) ??
        Messages.get('default')!;

      if (res.re) {
        err.re = res.re?.name ?? res.re?.source ?? '';
      }

      err.message = msg
        .replace(/\{([^}]+)\}/g, (a: string, k: string) => `${err[k as (keyof ValidationError)]}`);

      out.push(err as ValidationError);
    }
    return out;
  }

  /**
   * Validate an object against it's constructor's schema
   * @param cls The class to validate the objects against
   * @param o The object to validate
   * @param view The optional view to limit the scope to
   */
  static async validate<T>(cls: Class<T>, o: T, view?: string): Promise<T> {
    if (!Util.isPlainObject(o) && !(o instanceof cls || cls.ᚕid === (o as ClassInstance<T>).constructor.ᚕid)) {
      throw new TypeMismatchError(cls.name, (o as unknown as ClassInstance).constructor.name);
    }
    cls = SchemaRegistry.resolveSubTypeForInstance(cls, o);

    const config = SchemaRegistry.getViewSchema(cls, view);
    const validators = SchemaRegistry.get(cls).validators;

    // Validate using standard behaviors
    const errors = this.#validateSchema(config.schema, o, '');

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
   * @param cls The class to validate the objects against
   * @param obj The values to validate
   * @param view The view to limit by
   */
  static async validateAll<T>(cls: Class<T>, obj: T[], view?: string): Promise<T[]> {
    return await Promise.all<T>((obj ?? [])
      .map(o => this.validate(cls, o, view)));
  }

  /**
   * Validate partial, ignoring required fields as they are partial
   *
   * @param cls The class to validate against
   * @param o The value to validate
   * @param view The view to limit by
   */
  static async validatePartial<T>(cls: Class<T>, o: T, view?: string): Promise<T> {
    try {
      await this.validate(cls, o, view);
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

  /**
   * Validate method invocation
   *
   * @param cls The class to validate against
   * @param method The method being invoked
   * @param params The params to validate
   */
  static validateMethod<T>(cls: Class<T>, method: string, params: unknown[]) {
    const errors: ValidationError[] = [];
    for (const field of SchemaRegistry.getMethodSchema(cls, method)) {
      errors.push(...this.#validateFieldSchema(field, params[field.index!]));
    }
    if (errors.length) {
      throw new ValidationResultError(errors);
    }
  }
}