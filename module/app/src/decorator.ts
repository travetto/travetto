import * as fs from 'fs';

import { Class } from '@travetto/base';
import { FsUtil } from '@travetto/boot';
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
  return <T extends Class<AppClass>>(target: T) => {
    const out: Partial<ApplicationConfig> = {
      ...config ?? {},
      target,
      filename: target.ᚕfile,
      targetId: target.ᚕid,
      name: name.replace(/(\s+|[^A-Za-z0-9\-_])/g, '-').replace(/([a-z])([A-Z])/g, (_, l, u) => `${l}-${u.toLowerCase()}`),
      generatedTime: FsUtil.maxTime(fs.lstatSync(target.ᚕfile))
    };
    SchemaRegistry.register(target);
    ApplicationRegistry.register(out.name!, out as ApplicationConfig);
  };
}
