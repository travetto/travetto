import type { ServiceDescriptor } from '@travetto/cli';

const version = process.env.MYSQL_VERSION || '8.0';

export const service: ServiceDescriptor = {
  name: 'mysql',
  version,
  image: `mysql:${version}`,
  ports: { 3306: 3306 },
  env: {
    MYSQL_ROOT_PASSWORD: 'password',
    MYSQL_DATABASE: 'app'
  },
};