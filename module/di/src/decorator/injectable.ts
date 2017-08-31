import { Class, InjectableConfig } from '../types';
import { Registry, DEFAULT_INSTANCE } from '../service';

export function Injectable(config: Partial<InjectableConfig<any>> = {}) {
  return (target: Class<any>) => {
    config.class = target;
    Registry.register(config as InjectableConfig<any>);
    return target;
  };
}

export function Inject(config?: { name?: string, optiona?: boolean }) {
  return (...args: any[]) => { };
}