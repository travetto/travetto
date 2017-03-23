import * as cron from 'cron';
import {Startup, Shutdown} from '../service';

const JOBS = [];

interface CronOptions {
  timeZone?: string
}

export function Scheduled(expression:string, options?:CronOptions) {
  let conf:CronOptions & {cronTime:string} = Object.assign({cronTime:expression}, options || {});

  try {
    //Do nothing
	  new cron.CronJob(conf.cronTime, ()=>{});
  } catch(ex) {
	  throw new Error(`Cron pattern not valid: ${expression}`);
  }

  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    let config = Object.assign({onTick: target[propertyKey], context: target}, conf);
    registerJob(`${target.constructor.name}:${propertyKey}`, new cron.CronJob(config))
    return descriptor;
  }
}

function registerJob(name:string, job:cron.CronJob) {
  Startup.onStartup(job.start.bind(job));
  Shutdown.onShutdown(`Scheduled job: ${name}`, job.stop.bind(job));
}