import { Class } from '@travetto/registry';

import { ApplicationConfig, ApplicationParameter } from './types';
import { ApplicationRegistry } from './registry';

type AppClass = Class<{ run(...args: any[]): any }>;

export type AppDecorator = Partial<ApplicationConfig> & {
  paramMap?: {
    [key: string]: Partial<ApplicationParameter> & { name?: never };
  };
  params?: never;
};

/**
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
