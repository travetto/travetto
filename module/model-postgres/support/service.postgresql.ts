import type { CommandService } from '@travetto/command';

const version = process.env.POSTGRESQL_VERSION || '15.4';

export const service: CommandService = {
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