import { OptionConfig } from '@travetto/cli/src/command';

import { BaseOptions, BasePackCommand } from './cli-pack-base';
import { Zip, ZipConfig } from '../support/bin/zip';

type Options = BaseOptions & {
  output: OptionConfig<string>;
};

export class PackZipCommand extends BasePackCommand<Options, ZipConfig> {
  operation = Zip;

  getOptions(): Options {
    return {
      ...this.commonOptions(),
      output: this.option({ desc: 'Output File' })
    };
  }
}