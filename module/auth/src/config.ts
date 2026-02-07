import { Config } from '@travetto/config';
import { type TimeSpan, TimeUtil } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

@Config('auth')
export class AuthConfig {

  maxAge: TimeSpan | number = '1h';
  rollingRenew: boolean = true;

  @Ignore()
  maxAgeMs: number;

  postConstruct(): void {
    this.maxAgeMs = TimeUtil.duration(this.maxAge).total({ unit: 'milliseconds' });
  }
}