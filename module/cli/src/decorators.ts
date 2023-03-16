import { Class, ClassInstance, ConcreteClass } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { SchemaRegistry } from '@travetto/schema';

import { CliCommandShape } from './types';
import { CliCommandRegistry } from './registry';

/**
 * Decorator to register a CLI command
 * @augments `@travetto/schema:Schema`
 * @augments `@travetto/cli:CliCommand`
 */
export function CliCommand() {
  return function <T extends CliCommandShape>(target: Class<T>): void {
    const meta = RootIndex.getFunctionMetadata(target);
    if (meta && !meta.abstract) {
      const name = (meta.source.match(/cli.(.*)[.]tsx?$/)![1].replaceAll('_', ':'));
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      CliCommandRegistry.registerClass({ name, cls: target as ConcreteClass<T> });
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