import { Class } from '../types';
import { Registry, DEFAULT_INSTANCE, InjectableConfig } from '../service';

export function Injectable(config: Partial<InjectableConfig<any>> = {}) {
  return (target: Class<any>) => {
    config.class = target;
    Registry.register(config as InjectableConfig<any>);
    return target;
  };
}

export function Inject(name: string) {
  return (...args: any[]) => { };
}