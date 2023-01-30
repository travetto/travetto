import { Env } from '@travetto/base';
import type { CommandService } from '@travetto/command';

const version = Env.get('MYSQL_VERSION', '5.6');

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