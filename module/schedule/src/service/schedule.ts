import * as cron from 'cron';
import { Injectable } from '@encore/di';
import { Shutdown } from './shutdown';

type Callback = (...args: any[]) => any;

export interface CronOptions {
  timeZone?: string;
  context?: any;
  onTick: Callback;
  onComplete?: Callback;
}

@Injectable()
export class Schedule {
  private jobs: cron.CronJob[] = [];

  constructor(shutdown: Shutdown) {
    shutdown.onShutdown('scheule.kill', () => this.kill());
  }

  perDay(onTick: Callback) {
    this.schedule('0 0 0 * * *', { onTick });
  }

  perHour(onTick: Callback) {
    this.schedule('0 0 * * * *', { onTick });
  }

  perMinute(onTick: Callback) {
    this.schedule('0 * * * * *', { onTick });
  }

  perSecond(onTick: Callback) {
    this.schedule('* * * * * *', { onTick });
  }

  schedule(expression: string, options: CronOptions) {
    // Validate expression
    new cron.CronTime(expression)

    let job = new cron.CronJob(Object.assign({ cronTime: expression }, options));
    job.start();
    this.jobs.push(job);
  }

  private kill() {
    this.jobs.map(j => j.stop());
  }
}