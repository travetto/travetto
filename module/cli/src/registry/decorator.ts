import { type Class, type ClassInstance, Env, Runtime, RuntimeIndex, TypedObject, castTo, describeFunction, getClass } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex, type ValidationError } from '@travetto/schema';

import type { CliCommandShape } from '../types.ts';
import { CliCommandRegistryIndex } from './registry-index.ts';
import { CliModuleUtil } from '../module.ts';
import { CliParseUtil } from '../parse.ts';
import { CliUtil } from '../util.ts';

type Cmd = CliCommandShape & { profiles?: string[] };

type CliCommandConfigOptions = {
  runTarget?: boolean;
  runtimeModule?: 'current' | 'command';
  with?: {
    /** Application environment */
    profiles?: boolean;
    /** Module to run for */
    module?: boolean;
    /** Should debug invocation trigger via ipc */
    debugIpc?: boolean | 'optional';
    /** Should restart on source change */
    restartOnChange?: boolean | 'optional';
  };
};

type WithConfig = Required<Exclude<CliCommandConfigOptions['with'], undefined>>;
type WithHandler<K extends keyof WithConfig> = (config?: WithConfig[K]) => ({
  name: K;
  field: Partial<SchemaFieldConfig>;
  run?: (cmd: Cmd) => (Promise<unknown> | unknown);
} | undefined);

const FIELD_CONFIG: { [K in keyof WithConfig]: WithHandler<K> } = {
  profiles: (config) => {
    if (!config) { return; }
    return {
      name: 'profiles',
      run: cmd => cmd.profiles && Env.TRV_PROFILES.set([...cmd.profiles, ...(Env.TRV_PROFILES.list ?? [])]),
      field: {
        type: String,
        aliases: ['--profile', '--profiles', CliParseUtil.toEnvField(Env.TRV_PROFILES.key)],
        description: 'Application profiles',
        required: { active: false },
      },
    };
  },
  module: (config) => {
    if (!config) { return; }
    return {
      name: 'module',
      field: {
        type: String,
        aliases: ['-m', CliParseUtil.toEnvField(Env.TRV_MODULE.key)],
        description: 'Module to run for',
        specifiers: ['module'],
        required: { active: Runtime.monoRoot },
      },
    };
  },
  debugIpc: (config) => {
    if (!config) { return; }
    return {
      name: 'debugIpc',
      run: cmd => CliUtil.runWithDebugIpc(cmd),
      field: {
        type: Boolean,
        aliases: ['-di', CliParseUtil.toEnvField(Env.TRV_DEBUG_IPC.key)],
        description: 'Should debug invocation trigger via ipc',
        default: config !== 'optional',
        required: { active: false },
      },
    };
  },
  restartOnChange: (config) => {
    if (!config) { return; }
    return {
      name: 'restartOnChange',
      run: cmd => CliUtil.runWithRestartOnChange(cmd),
      field: {
        type: Boolean,
        aliases: ['-rc'],
        description: 'Should the invocation automatically restart on source changes',
        default: config !== 'optional' && Runtime.role === 'std' && !Runtime.production,
        required: { active: false },
      },
    };
  }
};

/**
 * Decorator to register a CLI command
 *
 * @augments `@travetto/schema:Schema`
 * @example method:main
 * @kind decorator
 */
export function CliCommand(config: CliCommandConfigOptions = {}) {
  return function <T extends CliCommandShape>(target: Class<T>): void {
    const adapter = SchemaRegistryIndex.getForRegister(target);
    const description = describeFunction(target) ?? {};

    if (!target.Ⲑid || description.abstract) {
      return;
    }

    const VALID_FIELDS = TypedObject.keys(FIELD_CONFIG).map((name) => FIELD_CONFIG[name](castTo(config.with?.[name]))).filter(x => !!x);

    CliCommandRegistryIndex.getForRegister(target).register({
      runTarget: config.runTarget,
      preMain: async (cmd: Cmd) => {
        for (const field of VALID_FIELDS) {
          await field.run?.(cmd);
        }
      }
    });

    const commandModule = description.module;

    for (const { name, field: { type, ...field } } of VALID_FIELDS) {
      adapter.registerField(name, { type }, field);
      Object.defineProperty(target.prototype, name, { value: field.default, writable: true });
    }

    const runtimeModule = config.runtimeModule ?? (config.with?.module ? 'current' : undefined);

    if (runtimeModule) { // Validate module
      adapter.register({
        validators: [async ({ module }): Promise<ValidationError | undefined> => {
          const runModule = (runtimeModule === 'command' ? commandModule : module) || Runtime.main.name;

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
  return function (instance: ClassInstance, property: string): void {
    const aliases = [
      ...(config.full ? [config.full.startsWith('-') ? config.full : `--${config.full}`] : []),
      ...(config.short ? [config.short.startsWith('-') ? config.short : `-${config.short}`] : []),
      ...(config.envVars ? config.envVars.map(CliParseUtil.toEnvField) : [])
    ];
    const specifiers = config.fileExtensions?.length ? ['file', ...config.fileExtensions.map(ext => `ext:${ext.replace(/[*.]/g, '')}`)] : [];

    SchemaRegistryIndex.getForRegister(getClass(instance)).registerField(property, { aliases, specifiers });
  };
}