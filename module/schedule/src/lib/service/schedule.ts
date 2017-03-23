import * as cron from 'cron';
import {Startup} from '../service';
import {OnStartup, OnShutdown} from '../decorator';

export interface CronOptions {
  timeZone?: string;
  context?: any;
  onTick: (...args:any[]) => any;
  onComplete?: (...args:any[]) => any;
}

export class Schedule {
  private static JOBS:cron.CronJob[] = [];

  static schedule(expression:string, options: CronOptions) {

    //Validate expression
    new cron.CronTime(expression)

    let job = new cron.CronJob(Object.assign({ cronTime: expression }, options));
    Schedule.JOBS.push(job);
    if (Startup.isDone) {
      process.nextTick(() => job.start());
    }
  }

  @OnStartup()
  static launch() {
    Schedule.JOBS.map(j => j.start())
  }

  @OnShutdown()
  static kill() {
    Schedule.JOBS.map(j => j.stop());
  }
}