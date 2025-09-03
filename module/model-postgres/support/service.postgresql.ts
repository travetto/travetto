import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.POSTGRESQL_VERSION || '17.6';

export const service: ServiceDescriptor = {
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