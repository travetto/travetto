import { OptionConfig } from '@travetto/cli/src/command';

import { BaseOptions, BasePackCommand } from './pack-base';
import { Zip, ZipConfig } from './operation/zip';

type Options = BaseOptions & {
  output: OptionConfig<string>;
};

export class PackZipCommand extends BasePackCommand<Options, ZipConfig> {
  operation = Zip;

  getOptions(): Options {
    return {
      ...this.defaultOptions(),
      output: this.option({ desc: 'Output File' })
    };
  }
}