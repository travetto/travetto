import { OptionConfig } from '@travetto/cli/src/plugin-base';

import { BaseOptions, BasePackPlugin } from './pack-base';
import { Docker, DockerConfig } from './operation/docker';

type Options = BaseOptions & {
  image: OptionConfig<string>;
  name: OptionConfig<string>;
  tag: OptionConfig<string[]>;
  port: OptionConfig<string[]>;
  push: OptionConfig<boolean>;
  registry: OptionConfig<string>;
};

export class PackDockerPlugin extends BasePackPlugin<Options, DockerConfig> {
  operation = Docker;

  getOptions(): Options {
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