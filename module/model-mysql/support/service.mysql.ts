import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.MYSQL_VERSION || '9.5';

export const service: ServiceDescriptor = {
  name: 'mysql',
  version,
  image: `mysql:${version}`,
  port: 3306,
  env: {
    MYSQL_RANDOM_ROOT_PASSWORD: '1',
    MYSQL_PASSWORD: 'travetto',
    MYSQL_USER: 'travetto',
    MYSQL_DATABASE: 'app'
  },
};