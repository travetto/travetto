import path from 'node:path';

import { RuntimeIndex } from '@travetto/runtime';
import { CliCommand, CliFlag, CliUtil, CliValidationError } from '@travetto/cli';
import { Ignore, Required } from '@travetto/schema';

import { DockerPackOperation } from './bin/docker-operation.ts';
import { BasePackCommand, PackOperationShape } from './pack.base';
import { DockerPackConfig } from '../src/types.ts';

const NODE_MAJOR = process.version.match(/\d+/)?.[0] ?? '22';

/**
 * Standard docker support for pack
 */
@CliCommand({ with: { module: true } })
export class PackDockerCommand extends BasePackCommand {
  /**  Docker Factory source */
  @CliFlag({ short: 'df', envVars: ['PACK_DOCKER_FACTORY'] })
  dockerFactory = '@travetto/pack/support/pack.dockerfile.ts';
  /**  Docker Image to extend */
  @CliFlag({ short: 'di', envVars: ['PACK_DOCKER_IMAGE'] })
  dockerImage = `node:${NODE_MAJOR}-alpine`;
  /**  Docker Image Name */
  @CliFlag({ short: 'dn', envVars: ['PACK_DOCKER_IMAGE'] })
  @Required(false)
  dockerName: string;
  /**  Docker Runtime user */
  @CliFlag({ short: 'ru', full: 'runtime-user', envVars: ['PACK_DOCKER_RUNTIME_USER'] })
  dockerRuntimeUser?: string;
  /**  Docker Runtime Packages */
  @CliFlag({ short: 'rp', full: 'runtime-package', envVars: ['PACK_DOCKER_RUNTIME_PACKAGES'] })
  dockerRuntimePackages: string[] = [];
  /**  Docker Image Port */
  @CliFlag({ short: 'dp', envVars: ['PACK_DOCKER_PORT'] })
  dockerPort: number[] = [];

  // Publish flags
  /**  Docker Stage Only */
  @CliFlag({ short: 'ds', envVars: ['PACK_DOCKER_STAGE'] })
  dockerStageOnly: boolean = false;
  /**  Docker Image Tag */
  @CliFlag({ short: 'dt', envVars: ['PACK_DOCKER_TAGS'] })
  dockerTag: string[] = ['latest'];
  /**  Docker Push Tags */
  @CliFlag({ short: 'dx', envVars: ['PACK_DOCKER_PUSH'] })
  dockerPush = false;
  /**  Docker Build Platform */
  @CliFlag({ short: 'db', envVars: ['PACK_DOCKER_BUILD_PLATFORM'] })
  dockerBuildPlatform?: string;
  /**  Docker Registry */
  @CliFlag({ short: 'dr', envVars: ['PACK_DOCKER_REGISTRY'] })
  dockerRegistry?: string;

  @Ignore()
  dockerRuntime: DockerPackConfig['dockerRuntime'];

  @Ignore()
  appFolder = 'app';

  @Ignore()
  defaultUser = this.appFolder;

  @Ignore()
  defaultUserId = 2000;

  async validate(): Promise<CliValidationError[] | undefined> {
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
    const [userOrUserId, groupOrGroupId = userOrUserId] = (this.dockerRuntimeUser ?? '').split(':');
    const groupIsNumber = /^\d+$/.test(groupOrGroupId);
    const userIsNumber = /^\d+$/.test(userOrUserId);

    const userId = userIsNumber ? +userOrUserId : this.defaultUserId;
    const groupId = groupIsNumber ? +groupOrGroupId : this.defaultUserId;
    const group = (!groupIsNumber ? groupOrGroupId : undefined) || this.defaultUser;
    const user = (!userIsNumber ? userOrUserId : undefined) || this.defaultUser;
    this.dockerRuntime = { user, userId, group, groupId, folder: `/${this.appFolder}`, packages: this.dockerRuntimePackages };

    if (this.dockerStageOnly) {
      if (this.dockerRegistry) {
        console.warn('Docker Registry is currently ignored due to --docker-build being false');
      }
      if (this.dockerBuildPlatform) {
        console.warn('Docker Build Platform is currently ignored due to --docker-build being false');
      }
      if (this.dockerPush) {
        console.warn('Docker Push is currently ignored due to --docker-build being false');
      }
      if (this.dockerTag) {
        console.warn('Docker Tag is currently ignored due to --docker-build being false');
      }
    }
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
      ...this.dockerStageOnly ? [] : [
        DockerPackOperation.buildDockerContainer,
        DockerPackOperation.pushDockerContainer
      ]
    ];
  }
}