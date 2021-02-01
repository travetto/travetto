// @file-if pg
import type { Service } from '@travetto/command/bin/lib/service';

const version = '12.2';

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