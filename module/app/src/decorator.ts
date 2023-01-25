import { lstatSync } from 'fs';

import { Class } from '@travetto/base';
import { SchemaRegistry } from '@travetto/schema';
import { RootIndex } from '@travetto/manifest';

import { ApplicationConfig, AppClass } from './types';
import { ApplicationRegistry } from './registry';

export type AppDecorator = { description?: string };

/**
 * Marks a class as a candidate for application execution. The application
 * has a name, and optional configuration for the various parameters.  The
 * compiler will automatically infer the parameters from the `run` method of
 * the class.
 *
 * @augments `@travetto/app:Application`
 * @augments `@travetto/di:Injectable`
 */
export function Application(name: string, config?: AppDecorator) {
  return <T extends Class<AppClass>>(target: T): void => {
    const src = RootIndex.getFunctionMetadata(target)!.source;
    const stat = lstatSync(src, { throwIfNoEntry: false }) ?? { mtimeMs: 0, ctimeMs: 0 };
    const finalName = name.replace(/(\s+|[^A-Za-z0-9\-_])/g, '-').replace(/([a-z])([A-Z])/g, (_, l, u) => `${l}-${u.toLowerCase()}`);
    const out: Partial<ApplicationConfig> = {
      params: [],
      ...config ?? {},
      globalName: finalName,
      target,
      module: RootIndex.manifest.mainModule,
      filename: src,
      targetId: target.Ⲑid,
      name: finalName,
      generatedTime: Math.max(stat.mtimeMs, stat.ctimeMs)
    };
    SchemaRegistry.register(target);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ApplicationRegistry.register(out.name!, out as ApplicationConfig);
  };
}
