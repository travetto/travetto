import { Class } from '@travetto/registry';
import { BaseError } from '@travetto/base';

import { FieldConfig, SchemaConfig } from '../types';
import { SchemaRegistry } from '../registry';
import { Messages } from './messages';

export type ValidationError = { message: string, path: string, kind: string };

export class ValidationErrors extends BaseError {
  constructor(public errors: ValidationError[]) {
    super('Errors have occurred');
  }
}

export class SchemaValidator {

  private static validateSchema<T>(schema: SchemaConfig, o: T, relative: string) {
    let errors: ValidationError[] = [];

    for (const field of Object.keys(schema)) {
      const fieldSchema = schema[field];
      const val = (o as any)[field];
      const path = `${relative}${relative && '.'}${field}`;

      const hasValue = !(val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0));

      if (!hasValue) {
        if (fieldSchema.required && fieldSchema.required.active) {
          errors.push(...this.prepareErrors(path, [{ kind: 'required', ...fieldSchema.required }]));
        }
        continue;
      }

      const { type, array } = fieldSchema;

      let sub: SchemaConfig | undefined;
      if (SchemaRegistry.has(type)) {
        sub = SchemaRegistry.getViewSchema(type, undefined).schema;
      } else if (type === Object) {
        sub = type as any as SchemaConfig;
      }

      if (array) {
        if (!Array.isArray(val)) {
          errors = errors.concat(this.prepareErrors(path, [{ kind: 'type', type: Array, value: val }]));
          continue;
        }
        if (sub) {
          for (let i = 0; i < val.length; i++) {
            const subErrors = this.validateSchema(sub, val[i], `${path}[${i}]`);
            errors = errors.concat(subErrors);
          }
        } else {
          for (let i = 0; i < val.length; i++) {
            const subErrors = this.validateField(fieldSchema, val[i], o);
            errors.push(...this.prepareErrors(`${path}[${i}]`, subErrors));
          }
        }
      } else if (sub) {
        const subErrors = this.validateSchema(sub, val, path);
        errors.push(...subErrors);
      } else {
        const fieldErrors = this.validateField(fieldSchema, val, o);
        errors.push(...this.prepareErrors(path, fieldErrors));
      }
    }

    return errors;
  }

  static validateRange(field: FieldConfig, key: 'min' | 'max', value: any) {
    const f = field[key];
    if (f) {
      if (typeof f.n === 'number') {
        if (typeof value !== 'number') {
          value = parseInt(value, 10);
        }
        if (field.type === Date) {
          value = new Date(value);
        }
        if (value < f.n) {
          return true;
        }
      } else {
        const date = f.n.getTime();
        if (typeof value === 'string') {
          value = Date.parse(value);
        }
        if (value < date) {
          return true;
        }
      }
    }
    return false;
  }

  static validateField(field: FieldConfig, value: any, parent: any) {
    const criteria: string[] = [];

    if (
      (field.type === String && (typeof value !== 'string')) ||
      (field.type === Number && ((typeof value !== 'number') || Number.isNaN(value))) ||
      (field.type === Date && !(value instanceof Date)) ||
      (field.type === Boolean && typeof value !== 'boolean')
    ) {
      criteria.push('type');
      return [{ kind: 'type', type: field.type.name.toLowerCase() }];
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

    if (this.validateRange(field, 'min', value)) {
      criteria.push('min');
    }

    if (this.validateRange(field, 'max', value)) {
      criteria.push('max');
    }

    const errors: ValidationError[] = [];
    for (const key of criteria) {
      const block = (field as any)[key];
      errors.push({ ...block, kind: key, value });
    }

    return errors;
  }

  static prepareErrors(path: string, errs: any[]) {
    const out = [];
    for (const err of errs) {
      err.path = path;

      const msg = err.message ||
        (err.re && Messages.get(err.re)) ||
        Messages.get(err.kind) ||
        Messages.get('default');


      if (err.re) {
        err.re = err.re.source;
      }

      err.message = msg
        .replace(/\{([^}]+)\}/g, (a: string, k: string) => err[k]);

      out.push(err);
    }
    return out;
  }

  static async validate<T>(o: T, view?: string): Promise<T> {
    const cls = o.constructor as Class;
    const config = SchemaRegistry.getViewSchema(cls, view);
    const validators = SchemaRegistry.get(cls).validators;

    const errors = this.validateSchema(config.schema, o, '');

    for (const fn of validators) {
      const res = fn(o, view);
      if (res) {
        errors.push(res);
      }
    }

    if (errors.length) {
      throw new ValidationErrors(errors);
    }

    return o;
  }

  static async validateAll<T>(obj: T[], view?: string): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => this.validate(o, view)));
  }
}