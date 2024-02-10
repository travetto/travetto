import { DockerPackFactory } from '../src/types';
import { PackConfigUtil } from '../src/config-util';

export const factory: DockerPackFactory = cfg => PackConfigUtil.dockerStandardFile(cfg);