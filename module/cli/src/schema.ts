import { castKey, castTo, getClass } from '@travetto/runtime';
import { BindUtil, SchemaRegistryIndex, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { ParsedState, CliCommandShape } from './types.ts';
import { CliValidationResultError } from './error.ts';

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
    const paramNames = SchemaRegistryIndex.getMethodConfig(cls, 'main').parameters.map(x => x.name!);

    const validators = [
      (): Promise<void> => SchemaValidator.validate(cls, cmd).then(() => { }),
      (): Promise<void> => SchemaValidator.validateMethod(cls, 'main', args, paramNames),
      async (): Promise<void> => {
        const res = await cmd.validate?.(...args);
        if (res) {
          throw new CliValidationResultError(cmd, Array.isArray(res) ? res : [res]);
        }
      },
    ];

    const SOURCES = ['flag', 'arg', 'custom'];

    const results = validators.map((x, i) => x().catch(err => {
      if (!(err instanceof CliValidationResultError) && !(err instanceof ValidationResultError)) {
        throw err;
      }
      return err.details.errors.map(v => ({ source: SOURCES[i], ...v }));
    }));

    const errors = (await Promise.all(results)).flatMap(x => (x ?? []));
    if (errors.length) {
      throw new CliValidationResultError(cmd, errors);
    }
    return cmd;
  }
}