import { Shutdown } from '../service';

export function OnShutdown() {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    Shutdown.onShutdown(`${target.name}-${propertyKey}`, () => target[propertyKey]());
    return descriptor;
  }
}