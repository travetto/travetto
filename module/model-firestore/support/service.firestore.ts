import type { CommandService } from '@travetto/command';

const version = process.env.FIRESTORE_VERSION || 'latest';

export const service: CommandService = {
  name: 'firestore',
  version,
  ports: { 7000: 8080 },
  env: {
    FIRESTORE_PROJECT_ID: 'trv-local-dev'
  },
  image: `mtlynch/firestore-emulator-docker:${version}`
};