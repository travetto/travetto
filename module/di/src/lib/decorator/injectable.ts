import { Class } from '../types';
import { Registry, DEFAULT_INSTANCE } from '../service';

export function Injectable(name: string = DEFAULT_INSTANCE, targetType?: Class<any>) {
  return (target: Class<any>) => {
    Registry.registerProvider(target, targetType, name);
    return target;
  };
}

export function InjectParams(params: any[]) {
  return (target: Class<any>) => {
    return target;
  }
}