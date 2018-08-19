import { Config } from '@travetto/config';

@Config('rest.koa')
export class KoaConfig {
  session = {
    key: 'secret1secret2secret3secret4secret5'
  };
}