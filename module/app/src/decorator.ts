import * as fs from 'fs';
import { Class } from '@travetto/base';
import { FsUtil } from '@travetto/boot';

import { ApplicationConfig, ApplicationParameter, AppClass } from './types';
import { ApplicationRegistry } from './registry';

export type AppDecorator = Partial<ApplicationConfig> & {
  paramMap?: {
    [key: string]: Partial<ApplicationParameter> & { name?: never };
  };
  params?: never;
};

/**
 * Marks a class as a candidate for application execution. The application
 * has a name, and optional configuration for the various parameters.  The
 * compiler will automatically infer the parameters from the `run` method of
 * the class.
 *
 * @augments `@trv:app/Application`
 * @augments `@trv:di/Injectable`
 */
export function Application(
  name: string,
  config?: AppDecorator,
  params?: (Partial<ApplicationParameter> & { name: string })[]
) {
  return <T extends Class<AppClass>>(target: T) => {
    const out: Partial<ApplicationConfig> = config ?? {};
    const paramMap = config?.paramMap ?? {};

    out.target = target;
    out.filename = target.ᚕfile;
    out.targetId = target.ᚕid;
    out.name = name.replace(/(\s+|[^A-Za-z0-9\-_])/g, '-');
    out.generatedTime = FsUtil.maxTime(fs.lstatSync(target.ᚕfile));

    if (params) {
      out.params = params.map(x => ({ ...x, ...(paramMap[x.name!] ?? {}), name: x.name! }) as ApplicationParameter);
    }

    ApplicationRegistry.register(out.name, out as ApplicationConfig);
    return target;
  };
}
