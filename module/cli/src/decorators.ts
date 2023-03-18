import { Class, ClassInstance, ConcreteClass } from '@travetto/base';
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
export function CliCommand() {
  return function <T extends CliCommandShape>(target: Class<T>): void {
    const meta = RootIndex.getFunctionMetadata(target);
    if (meta && !meta.abstract) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      CliCommandRegistry.registerClass({ module: getMod(target), name: getName(meta.source), cls: target as ConcreteClass<T> });
    }
  };
}

/**
 * Decorator to register a CLI Run command
 * @augments `@travetto/schema:Schema`
 * @augments `@travetto/cli:CliCommand`
 * @augments `@travetto/cli:CliRunCommand`
 */
export function CliRunCommand(cfg: { needsModule?: boolean }) {
  return function <T extends CliCommandShape>(target: Class<T>): void {
    const meta = RootIndex.getFunctionMetadata(target);
    if (!meta || meta.abstract) {
      return;
    }

    CliCommandRegistry.registerClass({
      module: getMod(target),
      name: getName(meta.source),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      cls: target as ConcreteClass<T>,
      runTarget: true,
      preMain: cmd => CliUtil.prepareRun(cmd)
    });

    const pendingCls = SchemaRegistry.getOrCreatePending(target);

    SchemaRegistry.registerPendingFieldConfig(target, 'env', String, {
      aliases: ['e'],
      description: 'Application environment',
      required: { active: false }
    });

    SchemaRegistry.registerPendingFieldConfig(target, 'profile', [String], {
      aliases: ['p'],
      description: 'Additional application profiles',
      required: { active: false }
    });

    if (cfg.needsModule) {
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