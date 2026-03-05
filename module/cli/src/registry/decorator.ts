import { type Class, type ClassInstance, Env, Runtime, RuntimeIndex, TypedObject, castTo, describeFunction, getClass } from '@travetto/runtime';
import { SchemaRegistryIndex, type ValidationError } from '@travetto/schema';

import type { CliCommandShape } from '../types.ts';
import { CliCommandRegistryIndex } from './registry-index.ts';
import { CliModuleUtil } from '../module.ts';
import { CliParseUtil } from '../parse.ts';
import { CliUtil } from '../util.ts';

type CliCommandConfigOptions = {
  runTarget?: boolean;
  runtimeModule?: 'current' | 'command';
};

/**
 * Allows for a CLI command to support profiles
 * @kind decorator
 */
export function CliProfilesSupport() {
  return function <T extends CliCommandShape>(cls: Class<T>): void {
    SchemaRegistryIndex.getForRegister(cls).registerField('profiles', {
      type: String,
      array: true,
      aliases: ['--profile', '--profiles', CliParseUtil.toEnvField(Env.TRV_PROFILES.key)],
      description: 'Application profiles',
      required: { active: false },
    });

    CliCommandRegistryIndex.getForRegister(cls).register({
      preMain: [cmd => {
        if ('profiles' in cmd && Array.isArray(cmd.profiles) && cmd.profiles.length > 0) {
          Env.TRV_PROFILES.set([...cmd.profiles, ...(Env.TRV_PROFILES.list ?? [])]);
        }
      }]
    });
  }
};

/**
 * Allows for a CLI command to support targeting a specific module
 * @kind decorator
 */
export function CliModuleSupport() {
  return function <T extends CliCommandShape>(cls: Class<T>): void {
    SchemaRegistryIndex.getForRegister(cls).registerField('module', {
      type: String,
      aliases: ['-m', CliParseUtil.toEnvField(Env.TRV_MODULE.key)],
      description: 'Module to run for',
      specifiers: ['module'],
      required: { active: Runtime.monoRoot },
    });
  }
}

/**
 * Allows for a CLI command to support restarting on source changes
 * @kind decorator
 */
export function CliRestartOnChangeSupport(defaultValue: boolean = false) {
  return function <T extends CliCommandShape>(cls: Class<T>): void {
    SchemaRegistryIndex.getForRegister(cls).registerField('restartOnChange', {
      type: Boolean,
      aliases: ['-rc'],
      description: 'Should the invocation automatically restart on source changes',
      default: defaultValue && Runtime.localDevelopment,
      required: { active: false },
    });

    CliCommandRegistryIndex.getForRegister(cls).register({
      runTarget: true,
      preMain: [cmd => CliUtil.runWithRestartOnChange(castTo<{ restartOnChange: boolean }>(cmd))]
    });

    Object.defineProperty(cls.prototype, 'restartOnChange', { value: defaultValue, writable: true })
  }
}

/**
 * Allows for a CLI command to support debugging invocations triggered via IPC
 * @kind decorator
 */
export function CliDebugIpcSupport(defaultValue = false) {
  return function <T extends CliCommandShape>(cls: Class<T>): void {
    SchemaRegistryIndex.getForRegister(cls).registerField('debugIpc', {
      type: Boolean,
      aliases: ['-di', CliParseUtil.toEnvField(Env.TRV_DEBUG_IPC.key)],
      description: 'Should debug invocation trigger via ipc',
      default: defaultValue,
      required: { active: false },
    });

    CliCommandRegistryIndex.getForRegister(cls).register({
      runTarget: true,
      preMain: [cmd => CliUtil.runWithDebugIpc(cmd._cfg!.name, castTo<{ debugIpc: boolean }>(cmd))]
    });

    Object.defineProperty(cls.prototype, 'debugIpc', { value: defaultValue, writable: true })
  }
}

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

    const commandModule = description.module;

    const runtimeModule = config.runtimeModule ?? (('module' in adapter.getFields()) ? 'current' : undefined);

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