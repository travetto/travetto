import { Class } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

import { BaseCliCommand } from './command';
import { CliCommandRegistry } from './registry';

/**
 * Decorator to register a CLI command
 * @augments `@travetto/schema:Schema`
 * @augments `@travetto/cli:CliCommand`
 */
export function CliCommand() {
  return function <T extends BaseCliCommand>(target: Class<T>): void {
    const file = RootIndex.getFunctionMetadata(target)!.source;
    const name = (file.match(/cli.(.*)[.]tsx?$/)![1].replaceAll('_', ':'));
    CliCommandRegistry.registerClass({ name, cls: target });
  };
}
