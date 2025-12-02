import { DockerPackFactory } from '../src/types.ts';
import { PackConfigUtil } from '../src/config-util.ts';

export const factory: DockerPackFactory = config => PackConfigUtil.dockerStandardFile(config);