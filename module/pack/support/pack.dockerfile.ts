import { DockerPackFactory } from './bin/types';
import { PackConfigUtil } from './bin/config-util';

export const factory: DockerPackFactory = cfg => PackConfigUtil.dockerStandardFile(cfg);