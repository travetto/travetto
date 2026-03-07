import { type Class, type ClassInstance, Env, Runtime, RuntimeIndex, castTo, describeFunction, getClass } from '@travetto/runtime';
import { SchemaRegistryIndex, type SchemaFieldConfig, type ValidationError } from '@travetto/schema';

import type { CliCommandShape } from '../types.ts';
import { CliCommandRegistryIndex } from './registry-index.ts';
import { CliModuleUtil } from '../module.ts';
import { CliParseUtil } from '../parse.ts';
import { CliUtil } from '../util.ts';

type CliCommandConfigOptions = { runTarget?: boolean };
type CliFlagOptions = { full?: string, short?: string, envVars?: string[] };

/**
 * Decorator to register a CLI command
 *
 * @augments `@travetto/schema:Schema`
 * @example method:main
 * @kind decorator
 */
export function CliCommand(config: CliCommandConfigOptions = {}) {
  return function <T extends CliCommandShape>(target: Class<T>): void {
    if (!target.Ⲑid || describeFunction(target)?.abstract) {
      return;
    }
    CliCommandRegistryIndex.getForRegister(target).register(config);
  };
}

function registerFlag(target: ClassInstance, property: string, config: CliFlagOptions, schemaConfig: Partial<SchemaFieldConfig>): void {
  SchemaRegistryIndex.getForRegister(getClass(target)).registerField(property, {
    ...schemaConfig,
    aliases: {
      ...(config.full ? [config.full.startsWith('-') ? config.full : `--${config.full}`] : []),
      ...(config.short ? [config.short.startsWith('-') ? config.short : `-${config.short}`] : []),
      ...(config.envVars ? config.envVars.map(CliParseUtil.toEnvField) : [])
    },
  });
}

/**
 * Decorator to register a CLI command flag
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function CliFlag(config: CliFlagOptions) {
  return function (instance: ClassInstance, property: string): void {
    registerFlag(instance, property, config, {});
  };
}

/**
 * Decorator to register a CLI command file flag
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function CliFileFlag(config: CliFlagOptions & { fileExtensions: string[] }) {
  return function (instance: ClassInstance, property: string): void {
    registerFlag(instance, property, config, {
      specifiers: ['file', ...config.fileExtensions.map(ext => `ext:${ext.replace(/[*.]/g, '')}`)]
    });
  };
}

/**
 * Registers a flag to support profiles via the `TRV_PROFILES` environment variable
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function CliProfilesFlag(config: CliFlagOptions = {}) {
  return function <K extends string>(instance: Partial<Record<K, string[]>>, property: K): void {
    registerFlag(instance, property,
      {
        ...config,
        envVars: [...(config.envVars ?? []), Env.TRV_PROFILES.key]
      },
      {
        required: { active: false },
        description: 'Application profiles'
      }
    );

    CliCommandRegistryIndex.getForRegister(getClass(instance)).register({
      preMain: [(cmd): void => {
        const typed: (typeof cmd) & { [property]?: string[] } = castTo(cmd);
        if (property in typed && Array.isArray(typed[property]) && typed[property]!.length > 0) {
          Env.TRV_PROFILES.set([...typed[property]!, ...(Env.TRV_PROFILES.list ?? [])]);
        }
      }]
    });
  };
};

/**
 * Registers a flag to support targeting a specific module
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function CliModuleFlag(config: CliFlagOptions & { scope: 'current' | 'command' } = { scope: 'current' }) {
  return function <K extends string>(instance: Partial<Record<K, string>>, property: K): void {
    const cls = getClass(instance);
    registerFlag(instance, property,
      {
        ...config,
        envVars: [...(config.envVars ?? []), Env.TRV_MODULE.key]
      },
      {
        description: 'Module to run for',
        specifiers: ['module'],
        required: { active: Runtime.monoRoot },
      }
    );

    const description = describeFunction(cls) ?? {};
    const commandModule = description.module;

    SchemaRegistryIndex.getForRegister(cls).register({
      validators: [async (cmd: CliCommandShape): Promise<ValidationError | undefined> => {
        const typed: (typeof cmd) & { [property]?: string } = castTo(cmd);
        const providedModule = typed[property];
        const runModule = (config.scope === 'command' ? commandModule : providedModule) || Runtime.main.name;

        // If we need to run as a specific module
        if (runModule !== Runtime.main.name) {
          try {
            RuntimeIndex.reinitForModule(runModule);
          } catch {
            return { source: 'flag', message: `${runModule} is an unknown module`, kind: 'custom', path: property };
          }
        }

        if (!(await CliModuleUtil.moduleHasDependency(runModule, commandModule))) {
          return { source: 'flag', message: `${runModule} does not have ${commandModule} as a dependency`, kind: 'custom', path: property };
        }
      }],
    });
  };
}

/**
 * Registers a flag to support restarting on source changes
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function CliRestartOnChangeFlag(config: CliFlagOptions = {}) {
  return function <K extends string, T extends Partial<Record<K, boolean>>>(instance: T, property: K): void {
    registerFlag(instance, property, config, {
      description: 'Should the invocation automatically restart on source changes',
      default: Runtime.localDevelopment,
      required: { active: false },
    });

    const cls = getClass(instance);
    CliCommandRegistryIndex.getForRegister(cls).register({
      runTarget: true,
      preMain: [(cmd): Promise<void> => {
        const typed: (typeof cmd) & { [property]?: boolean } = castTo(cmd);
        return CliUtil.runWithRestartOnChange(typed[property]);
      }]
    });
  };
}

/**
 * Registers a flag to support debugging invocations triggered via IPC
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function CliDebugIpcFlag(config: CliFlagOptions = {}) {
  return function <K extends string, T extends Partial<Record<K, boolean>>>(instance: T, property: K): void {
    registerFlag(instance, property,
      {
        ...config,
        envVars: [...(config.envVars ?? []), Env.TRV_DEBUG_IPC.key]
      },
      {
        description: 'Should the invocation automatically restart on source changes',
        default: Runtime.localDevelopment,
        required: { active: false },
      }
    );

    const cls = getClass(instance);
    CliCommandRegistryIndex.getForRegister(cls).register({
      runTarget: true,
      preMain: [(cmd): Promise<void> | void => {
        const typed: (typeof cmd) & { [property]?: boolean } = castTo(cmd);
        if (typed[property] === true) {
          return CliUtil.runWithDebugIpc(cmd._cfg!.name);
        }
      }]
    });
  };
}