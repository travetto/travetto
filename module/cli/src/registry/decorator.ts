import { Class, ClassInstance, Env, Runtime, RuntimeIndex, describeFunction, getClass } from '@travetto/runtime';
import { SchemaFieldConfig, SchemaRegistryIndex, ValidationError } from '@travetto/schema';

import { CliCommandShape } from '../types.ts';
import { CliCommandRegistryIndex } from './registry-index.ts';
import { CliModuleUtil } from '../module.ts';
import { CliParseUtil } from '../parse.ts';
import { CliUtil } from '../util.ts';

type Cmd = CliCommandShape & { env?: string };

type CliCommandConfigOptions = {
  runTarget?: boolean;
  runtimeModule?: 'current' | 'command';
  with?: {
    /** Application environment */
    env?: boolean;
    /** Module to run for */
    module?: boolean;
    /** Should debug invocation trigger via ipc */
    debugIpc?: boolean;
    /** Should the invocation automatically restart on exit */
    canRestart?: boolean;
  };
};

const FIELD_CONFIG: {
  name: keyof Exclude<CliCommandConfigOptions['with'], undefined>;
  field: Partial<SchemaFieldConfig>;
  run: (cmd: Cmd) => (Promise<unknown> | unknown);
}[] =
  [
    {
      name: 'env',
      run: cmd => Env.TRV_ENV.set(cmd.env || Runtime.env),
      field: {
        type: String,
        aliases: ['-e', CliParseUtil.toEnvField(Env.TRV_ENV.key)],
        description: 'Application environment',
        required: { active: false },
      },
    },
    {
      name: 'module',
      run: (): void => { },
      field: {
        type: String,
        aliases: ['-m', CliParseUtil.toEnvField(Env.TRV_MODULE.key)],
        description: 'Module to run for',
        specifiers: ['module'],
        required: { active: Runtime.monoRoot },
      },
    },
    {
      name: 'debugIpc',
      run: cmd => CliUtil.debugIfIpc(cmd).then((v) => v && process.exit(0)),
      field: {
        type: Boolean,
        aliases: ['-di'],
        description: 'Should debug invocation trigger via ipc',
        default: true,
        required: { active: false },
      },
    },
    {
      name: 'canRestart',
      run: cmd => CliUtil.runWithRestart(cmd)?.then((v) => v && process.exit(0)),
      field: {
        type: Boolean,
        aliases: ['-cr'],
        description: 'Should the invocation automatically restart on exit',
        default: false,
        required: { active: false },
      },
    }
  ];

/**
 * Decorator to register a CLI command
 *
 * @augments `@travetto/schema:Schema`
 * @example main
 * @kind decorator
 */
export function CliCommand(config: CliCommandConfigOptions = {}) {
  return function <T extends CliCommandShape>(target: Class<T>): void {
    const adapter = SchemaRegistryIndex.getForRegister(target);
    const description = describeFunction(target) ?? {};

    if (!target.Ⲑid || description.abstract) {
      return;
    }

    const VALID_FIELDS = FIELD_CONFIG.filter(f => !!config.with?.[f.name]);

    CliCommandRegistryIndex.getForRegister(target).register({
      runTarget: config.runTarget,
      preMain: async (cmd: Cmd) => {
        for (const field of VALID_FIELDS) {
          await field.run(cmd);
        }
      }
    });

    const commandModule = description.module;

    for (const { name, field: { type, ...field } } of VALID_FIELDS) {
      adapter.registerField(name, field, { type });
    }

    const runtimeModule = config.runtimeModule ?? (config.with?.module ? 'current' : undefined);

    if (runtimeModule) { // Validate module
      adapter.register({
        validators: [async ({ module: mod }): Promise<ValidationError | undefined> => {
          const runModule = (runtimeModule === 'command' ? commandModule : mod) || Runtime.main.name;

          // If we need to run as a specific module
          if (runModule !== Runtime.main.name) {
            try {
              RuntimeIndex.reinitForModule(runModule);
            } catch {
              return { source: 'flag', message: `${runModule} is an unknown module`, kind: 'custom', path: '.' };
            }
          }

          if (!(await CliModuleUtil.moduleHasDependency(runModule, commandModule))) {
            return { source: 'flag', message: `${runModule} does not have ${commandModule} as a dependency`, kind: 'custom', path: '.' };
          }
        }],
      });
    }
  };
}

/**
 * Decorator to register a CLI command flag
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function CliFlag(config: { full?: string, short?: string, fileExtensions?: string[], envVars?: string[] } = {}) {
  return function (instance: ClassInstance, property: string | symbol): void {
    const aliases = [
      ...(config.full ? [config.full.startsWith('-') ? config.full : `--${config.full}`] : []),
      ...(config.short ? [config.short.startsWith('-') ? config.short : `-${config.short}`] : []),
      ...(config.envVars ? config.envVars.map(CliParseUtil.toEnvField) : [])
    ];
    const specifiers = config.fileExtensions?.length ? ['file', ...config.fileExtensions.map(x => `ext:${x.replace(/[*.]/g, '')}`)] : [];

    SchemaRegistryIndex.getForRegister(getClass(instance)).registerField(property, { aliases, specifiers });
  };
}