import { path, RootIndex } from '@travetto/manifest';

import { DockerPackConfig, DockerPackOptions } from './bin/types';
import { DockerPackOperation } from './bin/docker-operation';
import { BasePackCommand, PackOperationShape } from './pack.base';


/**
 * Standard docker support for pack
 */
export class PackDockerCommand extends BasePackCommand<DockerPackOptions, DockerPackConfig> {

  name = 'pack:docker';

  getOptions(): DockerPackOptions {
    const opts = this.getCommonOptions();
    return {
      ...opts,
      dockerFactory: this.option({ short: 'df', desc: 'Docker Factory source', def: '@travetto/pack/support/pack.dockerfile' }),
      dockerImage: this.option({ short: 'di', desc: 'Docker Image to extend', def: 'node:18-alpine3.16' }),
      dockerName: this.option({ short: 'dn', desc: 'Docker Image Name', def: this.monoRoot ? '<module>' : this.getSimpleModuleName() }),
      dockerTag: this.listOption({ short: 'dt', desc: 'Docker Image Tag', def: ['latest'] }),
      dockerPort: this.listOption({ short: 'dp', desc: 'Docker Image Port' }),
      dockerPush: this.boolOption({ short: 'dx', desc: 'Docker Push Tags' }),
      dockerRegistry: this.option({ short: 'dr', desc: 'Docker Registry' })
    };
  }

  async buildConfig(): Promise<DockerPackConfig> {
    const cfg = await super.buildConfig();
    if (cfg.dockerFactory.startsWith('.')) {
      cfg.dockerFactory = RootIndex.getFromSource(path.resolve(cfg.dockerFactory))?.import ?? cfg.dockerFactory;
    }
    cfg.dockerPort ??= [];
    cfg.dockerTag ??= [];
    return cfg;
  }

  getOperations(): PackOperationShape<DockerPackConfig>[] {
    return [
      ...super.getOperations(),
      DockerPackOperation.writeDockerFile,
      DockerPackOperation.pullDockerBaseImage,
      DockerPackOperation.buildDockerContainer,
      DockerPackOperation.pushDockerContainer
    ];
  }
}