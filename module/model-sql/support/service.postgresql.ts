// @file-if pg
import { EnvUtil } from '@travetto/boot';
import type { Service } from '@travetto/command/bin/lib/service';

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