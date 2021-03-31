import { BasePackPlugin } from './pack-base';
import { Pack, AllConfig } from './operation/pack';

export class PackPlugin extends BasePackPlugin<AllConfig> {
  operation = Pack;

  getOptions() {
    return { workspace: this.option({ desc: 'Workspace directory' }) };
  }
}