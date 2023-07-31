import { DockerPackFactory } from './bin/types';
import { PackConfigUtil } from './bin/config-util';

export const factory: DockerPackFactory = cfg => [
  PackConfigUtil.dockerInit(cfg),
  PackConfigUtil.dockerWorkspace(cfg),
  PackConfigUtil.dockerEntrypoint(cfg),
].join('\n');