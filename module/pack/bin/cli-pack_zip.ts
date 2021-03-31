import { BasePackPlugin } from './pack-base';
import { Zip, ZipConfig } from './operation/zip';

export class PackZipPlugin extends BasePackPlugin<ZipConfig> {
  operation = Zip;

  getOptions() {
    return {
      workspace: this.option({ desc: 'Workspace directory' }),
      output: this.option({ desc: 'Output File' })
    };
  }
}