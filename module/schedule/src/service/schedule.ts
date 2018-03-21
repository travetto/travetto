import * as cron from 'cron';
import { Shutdown } from '@travetto/base';

type Callback = (...args: any[]) => any;

export interface CronOptions {
  timeZone?: string;
  context?: any;
  onTick: Callback;
  onComplete?: Callback;
}

export class Scheduler {
  private static jobId = 0;
  private static jobs = new Map<number, cron.CronJob>();

  static perDay(onTick: Callback) {
    return this.schedule('0 0 0 * * *', { onTick });
  }

  static perHour(onTick: Callback) {
    return this.schedule('0 0 * * * *', { onTick });
  }

  static perMinute(onTick: Callback) {
    return this.schedule('0 * * * * *', { onTick });
  }

  static perSecond(onTick: Callback) {
    return this.schedule('* * * * * *', { onTick });
  }

  static schedule(expression: string, options: CronOptions) {
    // Validate expression
    new cron.CronTime(expression)

    const job = new cron.CronJob(Object.assign({ cronTime: expression }, options));
    job.start();
    const id = this.jobId++;
    this.jobs.set(id, job);
    return id;
  }

  static kill() {
    for (const job of this.jobs.values()) {
      job.stop();
    }
  }
}

Shutdown.onShutdown('scheule.kill', () => Scheduler.kill());
