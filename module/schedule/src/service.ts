import * as cron from 'cron';

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

  static schedule(expression: string | Date, options: CronOptions) {
    // Validate expression
    new cron.CronTime(expression);

    const job = new cron.CronJob({ cronTime: expression, unrefTimeout: true, ...options });
    job.start();
    const id = this.jobId++;
    this.jobs.set(id, job);
    return id;
  }

  static stop(jobId: number) {
    this.jobs.get(jobId)!.stop();
    this.jobs.delete(jobId);
  }

  static kill() {
    for (const job of this.jobs.values()) {
      job.stop();
    }
  }
}