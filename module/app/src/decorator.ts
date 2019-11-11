import { Class } from '@travetto/registry';

import { ApplicationConfig, ApplicationParameter } from './types';
import { ApplicationRegistry } from './registry';

export type AppDecorator = Partial<ApplicationConfig> & {
  paramMap?: {
    [key: string]: Partial<ApplicationParameter> & { name?: never }
  }
  params?: never;
};

export function Application(
  name: string,
  config?: AppDecorator,
  params?: (Partial<ApplicationParameter> & { name: string })[]
): ClassDecorator {
  return (target: Class | any) => {
    const out: Partial<ApplicationConfig> = config ?? {};
    const paramMap = config?.paramMap ?? {};

    out.target = target;
    out.name = name.replace(/(\s+|[^A-Za-z0-9\-_])/g, '-');
    out.standalone = out.standalone === undefined || out.standalone; // Default to standalone

    if (params) {
      out.params = params.map(x => ({ ...x, ...(paramMap[x.name!] ?? {}), name: x.name! }) as ApplicationParameter);
    }

    ApplicationRegistry.register(out.name, out as ApplicationConfig);
    return target;
  };
}
