import { Class, ClassInstance, ConsoleManager, GlobalEnv, defineGlobalEnv } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { SchemaRegistry } from '@travetto/schema';

import { CliCommandShape, CliCommandShapeFields } from './types';
import { CliCommandRegistry, CliCommandConfigOptions } from './registry';
import { CliModuleUtil } from './module';
import { CliUtil } from './util';

/**
 * Decorator to register a CLI command
 * @augments `@travetto/schema:Schema`
 * @augments `@travetto/cli:CliCommand`
 */
export function CliCommand(cfg: CliCommandConfigOptions = {}) {
  return function <T extends CliCommandShape>(target: Class<T>): void {
    const meta = RootIndex.getFunctionMetadata(target);
    if (!meta || meta.abstract) {
      return;
    }

    const addModule = cfg.addModule === true || cfg.fields?.includes('module');
    const runtimeModule = cfg.runtimeModule ?? (cfg.addModule ? 'current' : undefined);
    const addEnv = cfg.addEnv ?? cfg.fields?.includes('env');
    const { commandModule } = CliCommandRegistry.registerClass(target, {
      preMain: async (cmd) => {
        if (addEnv && 'env' in cmd && typeof cmd.env === 'string') {
          defineGlobalEnv({ envName: cmd.env });
          ConsoleManager.setDebug(GlobalEnv.debug, GlobalEnv.devMode);
        }
      }
    });

    const pendingCls = SchemaRegistry.getOrCreatePending(target);

    if (addEnv) {
      SchemaRegistry.registerPendingFieldConfig(target, 'env', String, {
        aliases: ['e'],
        description: 'Application environment',
        required: { active: false }
      });
    }

    if (addModule) {
      SchemaRegistry.registerPendingFieldConfig(target, 'module', String, {
        aliases: ['m', 'env.TRV_MODULE'],
        description: 'Module to run for',
        required: { active: CliUtil.monoRoot }
      });
    }

    if (runtimeModule) { // Validate module
      (pendingCls.validators ??= []).push(async item => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const { module: mod } = item as CliCommandShapeFields;
        const runModule = (runtimeModule === 'command' ? commandModule : mod) || RootIndex.mainModuleName;

        // If we need to run as a specific module
        if (runModule !== RootIndex.mainModuleName) {
          try {
            RootIndex.reinitForModule(runModule);
          } catch (err) {
            return { source: 'flag', message: `${runModule} is an unknown module`, kind: 'custom', path: '.' };
          }
        }

        if (!(await CliModuleUtil.moduleHasDependency(runModule, commandModule))) {
          return { source: 'flag', message: `${runModule} does not have ${commandModule} as a dependency`, kind: 'custom', path: '.' };
        }
      });
    }
  };
}

/**
 * Decorator to register a CLI command flag
 */
export function CliFlag(cfg: { name?: string, short?: string, desc?: string, fileExtensions?: string[], envVars?: string[] }) {
  return function (target: ClassInstance, prop: string | symbol): void {
    const aliases: string[] = [];
    if (cfg.name) {
      aliases.push(cfg.name.startsWith('-') ? cfg.name : `--${cfg.name}`);
    }
    if (cfg.short) {
      aliases.push(cfg.short.startsWith('-') ? cfg.short : `-${cfg.short}`);
    }
    if (cfg.envVars) {
      aliases.push(...cfg.envVars.map(v => `env.${v}`));
    }
    if (typeof prop === 'string') {
      SchemaRegistry.registerPendingFieldFacet(target.constructor, prop, {
        aliases, description: cfg.desc,
        specifiers: cfg.fileExtensions?.length ? ['file', ...cfg.fileExtensions.map(x => `ext:${x.replace(/[*.]/g, '')}`)] : undefined
      });
    }
  };
}