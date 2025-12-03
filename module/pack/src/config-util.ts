import { DockerPackConfig } from './types.ts';

/**
 * Common utils for setting up pack config
 */
export class PackConfigUtil {
  /**
   * Docker setup
   */
  static dockerInit(config: DockerPackConfig): string {
    return `FROM ${config.dockerImage}`;
  }

  /**
   * Install docker pages in either apk or apt environments
   */
  static dockerPackageInstall(config: DockerPackConfig): string {
    const { os, packages } = config.dockerRuntime;
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
  static dockerNodePackageInstall(config: DockerPackConfig): string {
    const out: string[] = [];
    for (const item of config.externalDependencies ?? []) {
      const [name, directive] = item.split(':');
      switch (directive) {
        case 'from-source':
          out.push(`RUN npm_config_build_from_source=true npm install ${name} --build-from-source`); break;
        default:
          out.push(`RUN npm install ${name}`); break;
      }
    }
    if (out.length) {
      out.unshift(`WORKDIR ${config.dockerRuntime.folder}`);
    }
    return out.join('\n');
  }

  /**
   * Setup docker ports
   */
  static dockerPorts(config: DockerPackConfig): string {
    return (config.dockerPort?.map(port => `EXPOSE ${port}`) ?? []).join('\n');
  }

  /**
   * Setup docker user
   */
  static dockerUser(config: DockerPackConfig): string {
    const { os, user, group, userId, groupId } = config.dockerRuntime;
    if (user === 'root') {
      return '';
    } else {
      switch (os) {
        case 'alpine': return `RUN addgroup -g ${groupId} ${group} && adduser -D -G ${group} -u ${userId} ${user}`;
        case 'debian':
        case 'centos': return `RUN groupadd --gid ${groupId} ${group} && useradd -u ${userId} -g ${group} ${user}`;
        case 'unknown':
        default: throw new Error('Unable to add user/group for an unknown os');
      }
    }
  }

  /**
   * Setup Env Vars for NODE_OPTIONS and other standard environment variables
   */
  static dockerEnvVars(config: DockerPackConfig): string {
    return [
      `ENV NODE_OPTIONS="${[...(config.sourcemap ? ['--enable-source-maps'] : [])].join(' ')}"`,
    ].join('\n');
  }

  /**
   * Setup docker runtime folder
   */
  static dockerAppFolder(config: DockerPackConfig): string {
    const { folder, user, group } = config.dockerRuntime;
    return [
      `RUN mkdir ${folder} && chown ${user}:${group} ${folder}`,
    ].join('\n');
  }

  /**
   * Docker app files copied with proper permissions
   */
  static dockerAppFiles(config: DockerPackConfig): string {
    const { user, group, folder } = config.dockerRuntime;
    return `COPY --chown="${user}:${group}" . ${folder}`;
  }

  /**
   * Entrypoint creation for a docker configuration
   */
  static dockerEntrypoint(config: DockerPackConfig): string {
    const { user, folder } = config.dockerRuntime;
    return [
      `USER ${user}`,
      `WORKDIR ${folder}`,
      `ENTRYPOINT ["${folder}/${config.mainName}.sh"]`,
    ].join('\n');
  }
  /**
   * Common docker environment setup
   */
  static dockerWorkspace(config: DockerPackConfig): string {
    return [
      this.dockerPorts(config),
      this.dockerUser(config),
      this.dockerPackageInstall(config),
      this.dockerAppFolder(config),
      this.dockerAppFiles(config),
      this.dockerEnvVars(config),
    ].filter(line => !!line).join('\n');
  }

  /**
   * Common docker file setup
   */
  static dockerStandardFile(config: DockerPackConfig): string {
    return [
      this.dockerInit(config),
      this.dockerWorkspace(config),
      this.dockerNodePackageInstall(config),
      this.dockerEntrypoint(config)
    ].join('\n');
  }
}