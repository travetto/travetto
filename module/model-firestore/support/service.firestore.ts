import { Env } from '@travetto/base';
import type { Service } from '@travetto/command/support/bin/service';

const version = Env.get('TRV_SERVICE_FIRESTORE', 'latest');

export const service: Service = {
  name: 'firestore',
  version,
  ports: { 7000: 8080 },
  env: {
    FIRESTORE_PROJECT_ID: 'trv-local-dev'
  },
  image: `mtlynch/firestore-emulator-docker:${version}`
};