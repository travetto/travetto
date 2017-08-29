import { Class } from '../types';
import { Registry, DEFAULT_INSTANCE } from '../service';

export function Injectable(config: {
  name?: string,
  targetType?: Class<any>,
  dependencies?: any[]
} = {}) {
  return (target: Class<any>) => {
    config = { ...{ name: DEFAULT_INSTANCE }, ...config };
    Registry.registerProvider(target, config.targetType, config.name, config.dependencies);
    return target;
  };
}

export function Inject(name: string) {
  return (...args: any[]) => { };
}