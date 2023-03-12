import { path, RootIndex } from '@travetto/manifest';

import { DockerPackConfig } from './bin/types';
import { DockerPackOperation } from './bin/docker-operation';
import { BasePackCommand, PackOperationShape } from './pack.base';
import { CliCommand } from '@travetto/cli';
import { Alias } from '@travetto/schema';

/**
 * Standard docker support for pack
 */
@CliCommand()
export class PackDockerCommand extends BasePackCommand {
  /** Docker Factory source */
  @Alias('df')
  dockerFactory = '@travetto/pack/support/pack.dockerfile';
  /** Docker Image to extend */
  @Alias('di')
  dockerImage = 'node:18-alpine3.16';
  /** Docker Image Name */
  @Alias('dn')
  dockerName = this.monoRoot ? '<module>' : this.getSimpleModuleName();
  /** Docker Image Tag */
  @Alias('dt')
  dockerTag: string[] = ['latest'];
  /** Docker Image Port */
  @Alias('dp')
  dockerPort: string[] = [];
  /** Docker Push Tags */
  @Alias('dx')
  dockerPush = false;
  /** Docker Registry */
  @Alias('dr')
  dockerRegistry?: string;

  constructor() {
    super();
    if (this.dockerFactory.startsWith('.')) {
      this.dockerFactory = RootIndex.getFromSource(path.resolve(this.dockerFactory))?.import ?? this.dockerFactory;
    }
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