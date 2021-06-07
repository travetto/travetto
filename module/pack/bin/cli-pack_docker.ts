import { BasePackPlugin } from './pack-base';
import { Docker, DockerConfig } from './operation/docker';

export class PackDockerPlugin extends BasePackPlugin<DockerConfig> {
  operation = Docker;

  getOptions() {
    return {
      ...this.defaultOptions(),
      image: this.option({ desc: 'Docker Image to extend' }),
      name: this.option({ desc: 'Image Name' }),
      tag: this.listOption({ desc: 'Image Tag' }),
      port: this.listOption({ desc: 'Image Port' }),
      push: this.boolOption({ short: 'x', desc: 'Push Tags' }),
      registry: this.option({ desc: 'Registry' })
    };
  }
}