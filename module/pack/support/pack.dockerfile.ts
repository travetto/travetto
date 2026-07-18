import { PackConfigUtil } from '../src/config-util.ts';
import type { DockerPackFactory } from '../src/types.ts';

export const factory: DockerPackFactory = config => PackConfigUtil.dockerStandardFile(config);
