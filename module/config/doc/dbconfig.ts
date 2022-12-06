import { Config, EnvVar } from '@travetto/config';

@Config('database')
export class DBConfig {
  host: string;
  @EnvVar('DATABASE_PORT')
  port: number;
  creds: {
    user: string;
    password: string;
  };
}
