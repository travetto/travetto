import { EnvUtil } from '@travetto/boot';
import type { Service } from '@travetto/command/support/bin/service';

const version = EnvUtil.get('TRV_SERVICE_DYNAMODB', '1.15.0');

export const service: Service = {
  name: 'dynamodb',
  version,
  port: 8000,
  image: `amazon/dynamodb-local:${version}`
};