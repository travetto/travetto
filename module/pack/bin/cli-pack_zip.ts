import { BasePackPlugin } from './pack-base';
import { Zip, ZipConfig } from './operation/zip';

export class PackZipPlugin extends BasePackPlugin<ZipConfig> {
  operation = Zip;

  getOptions() {
    return {
      ...this.defaultOptions(),
      output: this.option({ desc: 'Output File' })
    };
  }
}