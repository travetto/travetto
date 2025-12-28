import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.POSTGRESQL_VERSION || '18.1';

export const service: ServiceDescriptor = {
  name: 'postgresql',
  version,
  port: 5432,
  image: `postgres:${version}-alpine`,
  env: {
    POSTGRES_USER: 'travetto',
    POSTGRES_PASSWORD: 'travetto',
    POSTGRES_DB: 'app'
  }
};