import { Config } from '@travetto/config';

@Config('rest.session.encode')
export class SessionEncoderConfig {
  sign = true;
  secret: string;
  keyName = 'trv_sid';
}