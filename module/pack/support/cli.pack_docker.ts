import path from 'node:path';

import { RuntimeIndex } from '@travetto/runtime';
import { CliCommand, CliFlag, CliUtil, CliValidationError } from '@travetto/cli';
import { Ignore, Required } from '@travetto/schema';

import { DockerPackOperation } from './bin/docker-operation';
import { BasePackCommand, PackOperationShape } from './pack.base';
import { DockerPackConfig } from '../src/types';

const NODE_MAJOR = process.version.match(/\d+/)?.[0] ?? '22';

/**
 * Standard docker support for pack
 */
@CliCommand({ addModule: true })
export class PackDockerCommand extends BasePackCommand {
  @CliFlag({ desc: 'Docker Factory source', short: 'df', envVars: ['PACK_DOCKER_FACTORY'] })
  dockerFactory = '@travetto/pack/support/pack.dockerfile';
  @CliFlag({ desc: 'Docker Image to extend', short: 'di', envVars: ['PACK_DOCKER_IMAGE'] })
  dockerImage = `node:${NODE_MAJOR}-alpine`;
  @CliFlag({ desc: 'Docker Image Name', short: 'dn', envVars: ['PACK_DOCKER_IMAGE'] })
  @Required(false)
  dockerName: string;
  @CliFlag({ desc: 'Docker Image Tag', short: 'dt', envVars: ['PACK_DOCKER_TAGS'] })
  dockerTag: string[] = ['latest'];
  @CliFlag({ desc: 'Docker Image Port', short: 'dp', envVars: ['PACK_DOCKER_PORT'] })
  dockerPort: number[] = [];
  @CliFlag({ desc: 'Docker Push Tags', short: 'dx', envVars: ['PACK_DOCKER_PUSH'] })
  dockerPush = false;
  @CliFlag({ desc: 'Docker Build Platform', short: 'db', envVars: ['PACK_DOCKER_BUILD_PLATFORM'] })
  dockerBuildPlatform?: string;
  @CliFlag({ desc: 'Docker Registry', short: 'dr', envVars: ['PACK_DOCKER_REGISTRY'] })
  dockerRegistry?: string;
  @CliFlag({ desc: 'Docker Runtime user', short: 'ru', name: 'runtime-user', envVars: ['PACK_DOCKER_RUNTIME_USER'] })
  dockerRuntimeUserSrc?: string;
  @CliFlag({ desc: 'Docker Runtime Packages', short: 'rp', name: 'runtime-package', envVars: ['PACK_DOCKER_RUNTIME_PACKAGES'] })
  dockerRuntimePackages: string[] = [];

  @Ignore()
  dockerRuntime: DockerPackConfig['dockerRuntime'];

  @Ignore()
  appFolder = 'app';

  @Ignore()
  defaultUser = this.appFolder;

  @Ignore()
  defaultUserId = 2000;

  async validate(...args: string[]): Promise<CliValidationError[] | undefined> {
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

  preMain(): void {
    if (this.dockerFactory.startsWith('.')) {
      this.dockerFactory = RuntimeIndex.getFromSource(path.resolve(this.dockerFactory))?.import ?? this.dockerFactory;
    }
    this.dockerName ??= CliUtil.getSimpleModuleName('<module>', this.module || undefined);

    // Finalize user/group and ids
    const [userOrUid, groupOrGid = userOrUid] = (this.dockerRuntimeUserSrc ?? '').split(':');
    const groupIsNum = /^\d+$/.test(groupOrGid);
    const userIsNum = /^\d+$/.test(userOrUid);

    const uid = userIsNum ? +userOrUid : this.defaultUserId;
    const gid = groupIsNum ? +groupOrGid : this.defaultUserId;
    const group = (!groupIsNum ? groupOrGid : undefined) || this.defaultUser;
    const user = (!userIsNum ? userOrUid : undefined) || this.defaultUser;
    this.dockerRuntime = { user, uid, group, gid, folder: `/${this.appFolder}`, packages: this.dockerRuntimePackages };
  }

  preHelp(): void {
    this.dockerName = CliUtil.getSimpleModuleName('<module>');
  }

  getOperations(): PackOperationShape<this>[] {
    return [
      ...super.getOperations(),
      DockerPackOperation.pullDockerBaseImage,
      DockerPackOperation.detectDockerImageOs,
      DockerPackOperation.writeDockerFile,
      DockerPackOperation.buildDockerContainer,
      DockerPackOperation.pushDockerContainer
    ];
  }
}