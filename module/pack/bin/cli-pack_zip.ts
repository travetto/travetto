import { OptionConfig } from '@travetto/cli/src/plugin-base';

import { BaseOptions, BasePackPlugin } from './pack-base';
import { Zip, ZipConfig } from './operation/zip';

type Options = BaseOptions & {
  output: OptionConfig<string>;
};

export class PackZipPlugin extends BasePackPlugin<Options, ZipConfig> {
  operation = Zip;

  getOptions(): Options {
    return {
      ...this.defaultOptions(),
      output: this.option({ desc: 'Output File' })
    };
  }
}