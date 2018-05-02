import { Config } from '@travetto/config';
import { AppEnv } from '@travetto/base';

@Config('logging')
export class LoggerConfig {
  level: string;
  replaceConsole: boolean = true;
}