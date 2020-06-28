import { Config } from '../../..';

@Config('database')
export class DBConfig {
  host: string;
  port: number;
  creds = {
    user: '',
    password: ''
  };
}
