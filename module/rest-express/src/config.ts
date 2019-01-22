import { Config } from '@travetto/config';

@Config('rest.express')
export class ExpressConfig {
  cookie = {
    secure: false
  };
  secret = 'secret';
  ssl?: boolean;
  keys?: {
    public: string,
    private: string
  };
}