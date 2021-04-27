import { EnvUtil } from '@travetto/boot';
import type { Service } from '@travetto/command/bin/lib/service';

const version = EnvUtil.get('TRV_SERVICE_FIRESTORE', 'latest');

export const service: Service = {
  name: 'firestore',
  version,
  ports: { 7000: 8080 },
  env: {
    FIRESTORE_PROJECT_ID: 'trv-local-dev'
  },
  image: `mtlynch/firestore-emulator-docker:${version}`
};