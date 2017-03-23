import * as cron from 'cron';
import {Startup, Shutdown} from '../service';

const JOBS:cron.CronJob[] = [];

interface CronOptions {
  timeZone?: string
}

export function Scheduled(expression:string, options?:CronOptions) {
  //Parse expression
  new cron.CronTime(expression)

  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    let config = Object.assign({
      cronTime:expression,
      onTick: target[propertyKey],
      context : target
    }, options || {});
    JOBS.push(new cron.CronJob(config));
    return descriptor;
  }
}

export const Daily = (options?:CronOptions) => Scheduled('0 0 0 * * ?', options);
export const Hourly = (options?:CronOptions) => Scheduled('0 0 * * * ?', options);

Startup.onStartup(() => JOBS.map(j => j.start()));
Shutdown.onShutdown('Shutting down jobs', () => JOBS.map(j => j.stop()));
