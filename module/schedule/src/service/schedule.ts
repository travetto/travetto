import * as cron from 'cron';
import { Injectable } from '@encore/di';
import { Shutdown } from './shutdown';

export interface CronOptions {
  timeZone?: string;
  context?: any;
  onTick: (...args: any[]) => any;
  onComplete?: (...args: any[]) => any;
}

@Injectable()
export class Schedule {
  private jobs: cron.CronJob[] = [];

  constructor() {
    Shutdown.onShutdown('scheule.kill', () => this.kill());
  }

  schedule(expression: string, options: CronOptions) {

    //Validate expression
    new cron.CronTime(expression)

    let job = new cron.CronJob(Object.assign({ cronTime: expression }, options));
    this.jobs.push(job);
  }

  launch() {
    this.jobs.map(j => j.start())
  }

  kill() {
    this.jobs.map(j => j.stop());
  }
}