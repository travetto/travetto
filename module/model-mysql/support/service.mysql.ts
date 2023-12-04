import type { CommandService } from '@travetto/command';

const version = process.env.MYSQL_VERSION || '8.0';

export const service: CommandService = {
  name: 'mysql',
  version,
  image: `mysql:${version}`,
  port: 3306,
  env: {
    MYSQL_ROOT_PASSWORD: 'password',
    MYSQL_DATABASE: 'app'
  },
};