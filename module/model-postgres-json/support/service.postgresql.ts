import type { ServiceDescriptor } from '@travetto/cli';

const postgresqlVersion = process.env.POSTGRESQL_VERSION || '18.3';

export const service: ServiceDescriptor = {
  name: 'postgresql',
  version: postgresqlVersion,
  port: 5432,
  image: `postgres:${postgresqlVersion}-alpine`,
  env: {
    POSTGRES_USER: 'travetto',
    POSTGRES_PASSWORD: 'travetto',
    POSTGRES_DB: 'app'
  }
};
