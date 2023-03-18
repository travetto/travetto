import { path, RootIndex } from '@travetto/manifest';
import { CliCommand, CliFlag, CliUtil } from '@travetto/cli';

import { DockerPackOperation } from './bin/docker-operation';
import { BasePackCommand, PackOperationShape } from './pack.base';

/**
 * Standard docker support for pack
 */
@CliCommand({ fields: ['module'] })
export class PackDockerCommand extends BasePackCommand {
  @CliFlag({ desc: 'Docker Factory source ', short: 'df', envVars: ['PACK_DOCKER_FACTORY'] })
  dockerFactory = '@travetto/pack/support/pack.dockerfile';
  @CliFlag({ desc: 'Docker Image to extend ', short: 'di', envVars: ['PACK_DOCKER_IMAGE'] })
  dockerImage = 'node:18-alpine3.16';
  @CliFlag({ desc: 'Docker Image Name ', short: 'dn', envVars: ['PACK_DOCKER_IMAGE'] })
  dockerName = CliUtil.monoRoot ? '<module>' : CliUtil.getSimpleModuleName();
  @CliFlag({ desc: 'Docker Image Tag ', short: 'dt', envVars: ['PACK_DOCKER_TAGS'] })
  dockerTag: string[] = ['latest'];
  @CliFlag({ desc: 'Docker Image Port ', short: 'dp', envVars: ['PACK_DOCKER_PORT'] })
  dockerPort: number[] = [];
  @CliFlag({ desc: 'Docker Push Tags ', short: 'dx', envVars: ['PACK_DOCKER_PUSH'] })
  dockerPush = false;
  @CliFlag({ desc: 'Docker Registry ', short: 'dr', envVars: ['PACK_DOCKER_REGISTRY'] })
  dockerRegistry?: string;

  finalize(unknownArgs: string[]): void {
    super.finalize(unknownArgs);
    if (this.dockerFactory.startsWith('.')) {
      this.dockerFactory = RootIndex.getFromSource(path.resolve(this.dockerFactory))?.import ?? this.dockerFactory;
    }
    this.dockerName = this.dockerName.replace('<module>', CliUtil.getSimpleModuleName(this.module ?? ''));
  }

  getOperations(): PackOperationShape<this>[] {
    return [
      ...super.getOperations(),
      DockerPackOperation.writeDockerFile,
      DockerPackOperation.pullDockerBaseImage,
      DockerPackOperation.buildDockerContainer,
      DockerPackOperation.pushDockerContainer
    ];
  }
}