import { Schedule } from '../service';

export function Scheduled(expression:string, options?: { timezone?: string }) {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    let config = Object.assign({
      onTick: target[propertyKey],
      context : target
    }, options || {});
    Schedule.schedule(expression, config);
    return descriptor;
  }
}


export const Daily = <T>(options?:T) => Scheduled('0 0 0 * * ?', options);
export const Hourly = <T>(options?:T) => Scheduled('0 0 * * * ?', options);

