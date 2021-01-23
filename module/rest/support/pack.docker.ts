import type { AllConfigPartial } from '@travetto/pack/bin/operation/pack';

export const config: AllConfigPartial = {
  name: 'rest/docker',
  assemble: {
    active: true,
    keepSource: false
  },
  docker: {
    active: true,
    env: {
      REST_PORT: 3000
    },
    port: [
      3000
    ]
  }
};