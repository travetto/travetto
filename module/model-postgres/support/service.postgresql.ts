import { EnvUtil } from '@travetto/base';
import type { Service } from '@travetto/command/support/bin/service';

const version = EnvUtil.get('TRV_SERVICE_POSTGRESQL', '12.2');

export const service: Service = {
  name: 'postgresql',
  version,
  port: 5432,
  image: `postgres:${version}-alpine`,
  env: {
    POSTGRES_USER: 'root',
    POSTGRES_PASSWORD: 'password',
    POSTGRES_DB: 'app'
  }
};