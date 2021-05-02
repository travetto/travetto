import { BasePackPlugin } from './pack-base';
import { Docker, DockerConfig } from './operation/docker';

export class PackDockerPlugin extends BasePackPlugin<DockerConfig> {
  operation = Docker;

  getOptions() {
    return {
      ...this.defaultOptions(),
      image: this.option({ desc: 'Docker Image to extend' }),
      tag: this.option({ desc: 'Image Tag' }),
      port: this.intOption({ desc: 'Image Port' })
    };
  }
}