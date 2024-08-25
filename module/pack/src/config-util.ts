import { DockerPackConfig } from './types';

/**
 * Common utils for setting up pack config
 */
export class PackConfigUtil {
  /**
   * Docker setup
   */
  static dockerInit(cfg: DockerPackConfig): string {
    return `FROM ${cfg.dockerImage}`;
  }

  /**
   * Install docker pages in either apk or apt environments
   */
  static dockerPackageInstall(cfg: DockerPackConfig): string {
    const { os, packages } = cfg.dockerRuntime;
    if (packages?.length) {
      switch (os) {
        case 'alpine': return `RUN apk --update add ${packages.join(' ')} && rm -rf /var/cache/apk/*`;
        case 'debian': return `RUN apt update && apt install -y ${packages.join(' ')} && rm -rf  /var/lib/{apt,dpkg,cache,log}/`;
        case 'centos': return `RUN yum -y install ${packages.join(' ')} && yum -y clean all && rm -fr /var/cache`;
        case 'unknown':
        default: throw new Error('Unable to install packages in an unknown os');
      }
    } else {
      return '';
    }
  }

  /**
   * Install docker pages in either apk or apt environments
   */
  static dockerNodePackageInstall(cfg: DockerPackConfig): string {
    const out: string[] = [];
    for (const item of cfg.externalDependencies ?? []) {
      out.push(item.endsWith(':from-source') ?
        `RUN npm_config_build_from_source=true npm install ${item.split(':')[0]} --build-from-source` :
        `RUN npm install ${item}`
      );
    }
    if (out.length) {
      out.unshift(`WORKDIR ${cfg.dockerRuntime.folder}`);
    }
    return out.join('\n');
  }

  /**
   * Setup docker ports
   */
  static dockerPorts(cfg: DockerPackConfig): string {
    return (cfg.dockerPort?.map(x => `EXPOSE ${x}`) ?? []).join('\n');
  }

  /**
   * Setup docker user
   */
  static dockerUser(cfg: DockerPackConfig): string {
    const { os, user, group, uid, gid } = cfg.dockerRuntime;
    if (user === 'root') {
      return '';
    } else {
      switch (os) {
        case 'alpine': return `RUN addgroup -g ${gid} ${group} && adduser -D -G ${group} -u ${uid} ${user}`;
        case 'debian':
        case 'centos': return `RUN groupadd --gid ${gid} ${group} && useradd -u ${uid} -g ${group} ${user}`;
        case 'unknown':
        default: throw new Error('Unable to add user/group for an unknown os');
      }
    }
  }

  /**
   * Setup Env Vars for NODE_OPTIONS and other standard environment variables
   */
  static dockerEnvVars(cfg: DockerPackConfig): string {
    return [
      `ENV NODE_OPTIONS="${[...(cfg.sourcemap ? ['--enable-source-maps'] : [])].join(' ')}"`,
    ].join('\n');
  }

  /**
   * Setup docker runtime folder
   */
  static dockerAppFolder(cfg: DockerPackConfig): string {
    const { folder, user, group } = cfg.dockerRuntime;
    return [
      `RUN mkdir ${folder} && chown ${user}:${group} ${folder}`,
    ].join('\n');
  }

  /**
   * Docker app files copied with proper permissions
   */
  static dockerAppFiles(cfg: DockerPackConfig): string {
    const { user, group, folder } = cfg.dockerRuntime;
    return `COPY --chown="${user}:${group}" . ${folder}`;
  }

  /**
   * Entrypoint creation for a docker configuration
   */
  static dockerEntrypoint(cfg: DockerPackConfig): string {
    const { user, folder } = cfg.dockerRuntime;
    return [
      `USER ${user}`,
      `WORKDIR ${folder}`,
      `ENTRYPOINT ["${folder}/${cfg.mainName}.sh"]`,
    ].join('\n');
  }
  /**
   * Common docker environment setup
   */
  static dockerWorkspace(cfg: DockerPackConfig): string {
    return [
      this.dockerPorts(cfg),
      this.dockerUser(cfg),
      this.dockerPackageInstall(cfg),
      this.dockerNodePackageInstall(cfg),
      this.dockerAppFolder(cfg),
      this.dockerAppFiles(cfg),
      this.dockerEnvVars(cfg),
    ].filter(x => !!x).join('\n');
  }

  /**
   * Common docker file setup
   */
  static dockerStandardFile(cfg: DockerPackConfig): string {
    return [
      this.dockerInit(cfg),
      this.dockerWorkspace(cfg),
      this.dockerEntrypoint(cfg)
    ].join('\n');
  }
}