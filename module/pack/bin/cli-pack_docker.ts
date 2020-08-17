import { BasePackPlugin } from './pack-base';
import { Docker } from './operation/docker';

export class PackDockerPlugin extends BasePackPlugin { operation = Docker; }