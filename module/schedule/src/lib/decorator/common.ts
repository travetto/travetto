import { Startup, Shutdown } from '../service';

export function OnShutdown() {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    Shutdown.onShutdown(`${target.name}-${propertyKey}`, () => target[propertyKey]());
    return descriptor;
  }
}

export function OnStartup() {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    Startup.onStartup(() => target[propertyKey]());
    return descriptor;
  };
}