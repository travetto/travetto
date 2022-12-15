import { lstatSync } from 'fs';

import { Class } from '@travetto/base';
import { SchemaRegistry } from '@travetto/schema';

import { ApplicationConfig, AppClass } from './types';
import { ApplicationRegistry } from './registry';

export type AppDecorator = { description?: string };

/**
 * Marks a class as a candidate for application execution. The application
 * has a name, and optional configuration for the various parameters.  The
 * compiler will automatically infer the parameters from the `run` method of
 * the class.
 *
 * @augments `@trv:app/Application`
 * @augments `@trv:di/Injectable`
 */
export function Application(name: string, config?: AppDecorator) {
  return <T extends Class<AppClass>>(target: T): void => {
    const stat = lstatSync(target.Ⲑsource);
    const out: Partial<ApplicationConfig> = {
      ...config ?? {},
      target,
      filename: target.Ⲑsource,
      targetId: target.Ⲑid,
      name: name.replace(/(\s+|[^A-Za-z0-9\-_])/g, '-').replace(/([a-z])([A-Z])/g, (_, l, u) => `${l}-${u.toLowerCase()}`),
      generatedTime: Math.max(stat.mtimeMs, stat.ctimeMs)
    };
    SchemaRegistry.register(target);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ApplicationRegistry.register(out.name!, out as ApplicationConfig);
  };
}
