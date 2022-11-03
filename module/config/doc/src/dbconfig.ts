import { Config } from '@travetto/config';

@Config('database')
export class DBConfig {
  host: string;
  port: number;
  creds: {
    user: string;
    password: string;
  };
}
