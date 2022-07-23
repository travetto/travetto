import { BasePackPlugin } from './pack-base';
import { Docker, DockerConfig } from './operation/docker';

export class PackDockerPlugin extends BasePackPlugin<DockerConfig> {
  operation = Docker;

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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