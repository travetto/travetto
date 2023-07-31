import { DockerPackFactory } from './bin/types';
import { PackConfigUtil } from './bin/config-util';

export const factory: DockerPackFactory = cfg => [
  PackConfigUtil.dockerSetup(cfg),
  PackConfigUtil.dockerUserCommand(cfg),
  PackConfigUtil.dockerCopyWorkspace(cfg),
  PackConfigUtil.dockerExposePorts(cfg),
  PackConfigUtil.dockerEntrypoint(cfg),
].join('\n');