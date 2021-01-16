import { BasePackPlugin } from './pack-base';
import { Docker, DockerConfig } from './operation/docker';

export class PackDockerPlugin extends BasePackPlugin<DockerConfig> { operation = Docker; }