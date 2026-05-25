import { Config } from '@travetto/config';

@Config('email')
export class EmailConfig {
  from = 'noreply@example.com';
}
