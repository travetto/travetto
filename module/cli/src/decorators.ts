import { Class, ClassInstance, ConcreteClass, ConsoleManager, defineGlobalEnv } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { SchemaRegistry } from '@travetto/schema';

import { CliCommandShape } from './types';
import { CliCommandRegistry } from './registry';
import { CliModuleUtil } from './module';
import { CliUtil } from './util';

const getName = (source: string): string => source.match(/cli.(.*)[.]tsx?$/)![1].replaceAll('_', ':');
const getMod = (cls: Class): string => RootIndex.getModuleFromSource(RootIndex.getFunctionMetadata(cls)!.source)!.name;

/**
 * Decorator to register a CLI command
 * @augments `@travetto/schema:Schema`
 * @augments `@travetto/cli:CliCommand`
 */
export function CliCommand(cfg: { addModule?: boolean, addProfile?: boolean, addEnv?: boolean, runTarget?: boolean, hidden?: boolean } = {}) {
  return function <T extends CliCommandShape>(target: Class<T>): void {
    const meta = RootIndex.getFunctionMetadata(target);
    if (!meta || meta.abstract) {
      return;
    }

    const name = getName(meta.source);

    if (name.startsWith('run:') || cfg.runTarget) {
      cfg = { runTarget: true, addProfile: true, addEnv: true, ...cfg };
    }

    CliCommandRegistry.registerClass({
      module: getMod(target),
      name,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      cls: target as ConcreteClass<T>,
      hidden: cfg.hidden,
      preMain: (cmd: CliCommandShape & { env?: string, profile?: string[], module?: string }) => {
        if (cfg.addEnv) { defineGlobalEnv({ envName: cmd.env }); }
        if (cfg.addProfile) { defineGlobalEnv({ profiles: cmd.profile }); }
        if (cfg.addEnv || cfg.addProfile) { ConsoleManager.setDebugFromEnv(); }
        if (cfg.addModule) {
          if (cmd.module && cmd.module !== RootIndex.mainModule.name) { // Mono-repo support
            RootIndex.reinitForModule(cmd.module); // Reinit with specified module
          }
        }
      }
    });

    const pendingCls = SchemaRegistry.getOrCreatePending(target);

    if (cfg.addEnv) {
      SchemaRegistry.registerPendingFieldConfig(target, 'env', String, {
        aliases: ['e'],
        description: 'Application environment',
        required: { active: false }
      });
    }

    if (cfg.addProfile) {
      SchemaRegistry.registerPendingFieldConfig(target, 'profile', [String], {
        aliases: ['p'],
        description: 'Additional application profiles',
        required: { active: false }
      });
    }

    if (cfg.addModule) {
      SchemaRegistry.registerPendingFieldConfig(target, 'module', [String], {
        aliases: ['m'],
        description: 'Module to run for',
        required: { active: CliUtil.monoRoot }
      });

      // Register validator for module
      (pendingCls.validators ??= []).push(item =>
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        CliModuleUtil.validateCommandModule(getMod(target), item as { module?: string })
      );
    }
  };
}

/**
 * Decorator to register a CLI command flag
 */
export function CliFlag(cfg: { name?: string, short?: string, desc?: string }) {
  return function (target: ClassInstance, prop: string | symbol): void {
    const aliases: string[] = [];
    if (cfg.name) {
      aliases.push(cfg.name.startsWith('-') ? cfg.name : `--${cfg.name}`);
    }
    if (cfg.short) {
      aliases.push(cfg.short.startsWith('-') ? cfg.short : `-${cfg.short}`);
    }
    if (typeof prop === 'string') {
      SchemaRegistry.registerPendingFieldFacet(target.constructor, prop, { aliases, description: cfg.desc });
    }
  };
}