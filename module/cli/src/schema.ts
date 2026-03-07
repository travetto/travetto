import { castKey, castTo, getClass } from '@travetto/runtime';
import { BindUtil, SchemaRegistryIndex, SchemaValidator, ValidationResultError, type ValidationError } from '@travetto/schema';

import type { ParsedState, CliCommandShape } from './types.ts';
import { CliValidationResultError } from './error.ts';

const getSource = (source: string | undefined, defaultSource: ValidationError['source']): ValidationError['source'] => {
  switch (source) {
    case 'custom':
    case 'arg':
    case 'flag': return source;
    case undefined: return defaultSource;
    default: return 'custom';
  }
};

const transformErrors = (source: 'arg' | 'flag', error: unknown): ValidationError[] => {
  if (error instanceof CliValidationResultError || error instanceof ValidationResultError) {
    return error.details.errors.map(value => ({ source: getSource(value.source, source), ...value }));
  } else {
    throw error;
  }
};

const transformArgErrors = (error: unknown): ValidationError[] => transformErrors('arg', error);
const transformFlagErrors = (error: unknown): ValidationError[] => transformErrors('flag', error);

/**
 * Allows binding describing/binding inputs for commands
 */
export class CliCommandSchemaUtil {
  /**
   * Bind parsed inputs to command
   */
  static bindInput<T extends CliCommandShape>(cmd: T, state: ParsedState): unknown[] {
    const template: Partial<T> = {};
    const bound: unknown[] = [];

    for (const arg of state.all) {
      switch (arg.type) {
        case 'flag': {
          const key = castKey<T>(arg.fieldName);
          const value = arg.value!;
          if (arg.array) {
            castTo<unknown[]>(template[key] ??= castTo([])).push(value);
          } else {
            template[key] = castTo(value);
          }
          break;
        }
        case 'arg': {
          if (arg.array) {
            castTo<unknown[]>(bound[arg.index] ??= []).push(arg.input);
          } else {
            bound[arg.index] = arg.input;
          }
        }
      }
    }

    const cls = getClass(cmd);
    BindUtil.bindSchemaToObject(cls, cmd, template);
    return BindUtil.coerceMethodParams(cls, 'main', bound);
  }

  /**
   * Validate command shape with the given arguments
   */
  static async validate(cmd: CliCommandShape, args: unknown[]): Promise<typeof cmd> {
    const cls = getClass(cmd);
    const paramNames = SchemaRegistryIndex.get(cls).getMethod('main').parameters.map(config => config.name!);

    const results = await Promise.all([
      SchemaValidator.validate(cls, cmd).then(() => [], transformFlagErrors),
      SchemaValidator.validateMethod(cls, 'main', args, paramNames).then(() => [], transformArgErrors),
    ]);

    const errors = results.flat();
    if (errors.length) {
      throw new CliValidationResultError(cmd, errors);
    }
    return cmd;
  }
}