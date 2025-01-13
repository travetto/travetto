import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.MYSQL_VERSION || '9.1';

export const service: ServiceDescriptor = {
  name: 'mysql',
  version,
  image: `mysql:${version}`,
  port: 3306,
  env: {
    MYSQL_ROOT_PASSWORD: 'password',
    MYSQL_DATABASE: 'app'
  },
};