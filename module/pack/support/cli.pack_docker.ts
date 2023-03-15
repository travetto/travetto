import { path, RootIndex } from '@travetto/manifest';

import { DockerPackOperation } from './bin/docker-operation';
import { BasePackCommand, PackOperationShape } from './pack.base';
import { CliCommand, CliFlag } from '@travetto/cli';

/**
 * Standard docker support for pack
 */
@CliCommand()
export class PackDockerCommand extends BasePackCommand {
  @CliFlag({ desc: 'Docker Factory source ', short: 'df' })
  dockerFactory = '@travetto/pack/support/pack.dockerfile';
  @CliFlag({ desc: 'Docker Image to extend ', short: 'di' })
  dockerImage = 'node:18-alpine3.16';
  @CliFlag({ desc: 'Docker Image Name ', short: 'dn' })
  dockerName = PackDockerCommand.monoRoot ? '<module>' : PackDockerCommand.getSimpleModuleName();
  @CliFlag({ desc: 'Docker Image Tag ', short: 'dt' })
  dockerTag: string[] = ['latest'];
  @CliFlag({ desc: 'Docker Image Port ', short: 'dp' })
  dockerPort: string[] = [];
  @CliFlag({ desc: 'Docker Push Tags ', short: 'dx' })
  dockerPush = false;
  @CliFlag({ desc: 'Docker Registry ', short: 'dr' })
  dockerRegistry?: string;

  finalize(): void {
    super.finalize();
    if (this.dockerFactory.startsWith('.')) {
      this.dockerFactory = RootIndex.getFromSource(path.resolve(this.dockerFactory))?.import ?? this.dockerFactory;
    }
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