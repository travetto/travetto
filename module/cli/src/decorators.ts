import { Class, ClassInstance, ConcreteClass, ConsoleManager, GlobalEnv, defineGlobalEnv } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { SchemaRegistry } from '@travetto/schema';

import { CliCommandShape } from './types';
import { CliCommandRegistry, CliCommandConfigOptions } from './registry';
import { CliModuleUtil } from './module';
import { CliUtil } from './util';

type ExtraFields = 'module' | 'env';

const getName = (source: string): string => (source.match(/cli[.](.*)[.]tsx?$/)?.[1] ?? source).replaceAll('_', ':');
const getMod = (cls: Class): string => RootIndex.getModuleFromSource(RootIndex.getFunctionMetadata(cls)!.source)!.name;

/**
 * Decorator to register a CLI command
 * @augments `@travetto/schema:Schema`
 * @augments `@travetto/cli:CliCommand`
 */
export function CliCommand({ fields, ...cfg }: { fields?: ExtraFields[] } & CliCommandConfigOptions = {}) {
  return function <T extends CliCommandShape>(target: Class<T>): void {
    const meta = RootIndex.getFunctionMetadata(target);
    if (!meta || meta.abstract) {
      return;
    }

    const name = getName(meta.source);
    const addEnv = fields?.includes('env');
    const addModule = fields?.includes('module');

    CliCommandRegistry.registerClass({
      module: getMod(target),
      name,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      cls: target as ConcreteClass<T>,
      ...cfg,
      preMain: (cmd: CliCommandShape & { env?: string, module?: string }) => {
        if (addEnv) {
          defineGlobalEnv({ envName: cmd.env });
          ConsoleManager.setDebug(GlobalEnv.debug, GlobalEnv.devMode);
        }
        if (addModule && cmd.module && cmd.module !== RootIndex.mainModuleName) { // Mono-repo support
          RootIndex.reinitForModule(cmd.module); // Reinit with specified module
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

      // Register validator for module
      (pendingCls.validators ??= []).push(async item => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const res = await CliModuleUtil.validateCommandModule(getMod(target), item as { module?: string });
        return res ? { ...res, kind: 'custom', path: '.' } : res;
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