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
      dockerImage: this.option({ short: 'di', desc: 'Docker Image to extend', def: 'node:18-alpine3.16' }),
      dockerName: this.option({ short: 'dn', desc: 'Docker Image Name', def: this.getSimpleModuleName() }),
      dockerTag: this.listOption({ short: 'dt', desc: 'Docker Image Tag', def: ['latest'] }),
      dockerPort: this.listOption({ short: 'dp', desc: 'Docker Image Port' }),
      dockerPush: this.boolOption({ short: 'dx', desc: 'Docker Push Tags' }),
      dockerRegistry: this.option({ short: 'dr', desc: 'Docker Registry' })
    };
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