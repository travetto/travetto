// @file-if mysql
import { EnvUtil } from '@travetto/boot/src';
import type { Service } from '@travetto/command/bin/lib/service';

const version = EnvUtil.get('TRV_SERVICE_MYSQL', '5.6');

export const service: Service = {
  name: 'mysql',
  version,
  image: `mysql:${version}`,
  port: 3306,
  env: {
    MYSQL_ROOT_PASSWORD: 'password',
    MYSQL_DATABASE: 'app'
  },
};