import { OptionConfig, ListOptionConfig } from '@travetto/cli/src/command';

import { BaseOptions, BasePackCommand } from './pack-base';
import { Docker, DockerConfig } from './operation/docker';

type Options = BaseOptions & {
  image: OptionConfig<string>;
  name: OptionConfig<string>;
  tag: ListOptionConfig<string>;
  port: ListOptionConfig<string>;
  push: OptionConfig<boolean>;
  registry: OptionConfig<string>;
};

export class PackDockerCommand extends BasePackCommand<Options, DockerConfig> {
  operation = Docker;

  getOptions(): Options {
    return {
      ...this.commonOptions(),
      image: this.option({ desc: 'Docker Image to extend' }),
      name: this.option({ desc: 'Image Name' }),
      tag: this.listOption({ desc: 'Image Tag' }),
      port: this.listOption({ desc: 'Image Port' }),
      push: this.boolOption({ short: 'x', desc: 'Push Tags' }),
      registry: this.option({ desc: 'Registry' })
    };
  }
}