import { Class } from '@travetto/registry';

import { ApplicationConfig, ApplicationParameter, ApplicationHandle } from './types';
import { ApplicationRegistry } from './registry';

type OrProm<T> = T | Promise<T>;
type AppClass = Class<{ run(...args: any[]): OrProm<ApplicationHandle | void | undefined> }>;

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
 * @augments trv/app/Application
 * @augments trv/di/Injectable
 */
export function Application(
  name: string,
  config?: AppDecorator,
  params?: (Partial<ApplicationParameter> & { name: string })[]
) {
  return <T extends AppClass>(target: T) => {
    const out: Partial<ApplicationConfig> = config ?? {};
    const paramMap = config?.paramMap ?? {};

    out.target = target;
    out.name = name.replace(/(\s+|[^A-Za-z0-9\-_])/g, '-');

    if (params) {
      out.params = params.map(x => ({ ...x, ...(paramMap[x.name!] ?? {}), name: x.name! }) as ApplicationParameter);
    }

    ApplicationRegistry.register(out.name, out as ApplicationConfig);
    return target;
  };
}
