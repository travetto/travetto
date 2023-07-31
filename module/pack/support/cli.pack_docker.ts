import { path, RootIndex } from '@travetto/manifest';
import { CliCommand, CliFlag, CliUtil, CliValidationError } from '@travetto/cli';

import { DockerPackOperation } from './bin/docker-operation';
import { BasePackCommand, PackOperationShape } from './pack.base';
import { GlobalEnv } from '@travetto/base';
import { Ignore } from '@travetto/schema';

const NODE_MAJOR = GlobalEnv.nodeVersion.replace('v', '').split('.')[0];
const DEFAULT_USER_ID = 2000;
const DEFAULT_USER = 'app';

/**
 * Standard docker support for pack
 */
@CliCommand({ fields: ['module'] })
export class PackDockerCommand extends BasePackCommand {
  @CliFlag({ desc: 'Docker Factory source ', short: 'df', envVars: ['PACK_DOCKER_FACTORY'] })
  dockerFactory = '@travetto/pack/support/pack.dockerfile';
  @CliFlag({ desc: 'Docker Image to extend ', short: 'di', envVars: ['PACK_DOCKER_IMAGE'] })
  dockerImage = `node:${NODE_MAJOR}-alpine`;
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
  @CliFlag({ desc: 'Docker Runtime user ', short: 'du', name: 'docker-runtime-user', envVars: ['PACK_DOCKER_RUNTIME_USER'] })
  dockerRuntimeUserSrc?: string;

  @Ignore()
  dockerRuntimeUser: {
    user: string;
    uid: number;
    group: string;
    gid: number;
  };

  async validate(...unknownArgs: string[]): Promise<CliValidationError[] | undefined> {
    const errs: CliValidationError[] = [];
    if (this.dockerPort?.length) {
      for (let i = 0; i < this.dockerPort.length; i++) {
        if (this.dockerPort[i] < 1) {
          errs.push({ source: 'flag', message: `dockerPort[${i}] is less than (1)` });
        } else if (this.dockerPort[i] > 65536) {
          errs.push({ source: 'flag', message: `dockerPort[${i}] is greater than (65536)` });
        }
      }
    }
    return errs;
  }

  finalize(unknownArgs: string[]): void {
    super.finalize(unknownArgs);
    if (this.dockerFactory.startsWith('.')) {
      this.dockerFactory = RootIndex.getFromSource(path.resolve(this.dockerFactory))?.import ?? this.dockerFactory;
    }
    this.dockerName = this.dockerName.replace('<module>', CliUtil.getSimpleModuleName(this.module ?? ''));

    // Finalize user/group and ids
    const [userOrUid, groupOrGid = userOrUid] = (this.dockerRuntimeUserSrc ?? '').split(':');
    const groupIsNum = /^\d+$/.test(groupOrGid);
    const userIsNum = /^\d+$/.test(userOrUid);

    const uid = userIsNum ? +userOrUid : DEFAULT_USER_ID;
    const gid = groupIsNum ? +groupOrGid : DEFAULT_USER_ID;
    const group = (!groupIsNum ? groupOrGid : undefined) || DEFAULT_USER;
    const user = (!userIsNum ? userOrUid : undefined) || DEFAULT_USER;
    this.dockerRuntimeUser = { user, uid, group, gid };
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