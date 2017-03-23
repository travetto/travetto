import { Schedule } from '../service';

export function Scheduled(expression:string, options?: { timezone?: string }) {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    let config = Object.assign({
      onTick: target[propertyKey],
      context : target
    }, options || {});
    Schedule.schedule(expression, config);
    return descriptor;
  };
}