import { DockerPackConfig } from './types';

const ifElse = (check: string, succ: string, fail: string): string => `${check} && (${succ}) || (${fail})`;

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
    const { packages } = cfg.dockerRuntime;
    if (packages?.length) {
      return ifElse('RUN which apk',
        `apk --update add ${packages.join(' ')} && rm -rf /var/cache/apk/*`,
        `apt update && apt install -y ${packages.join(' ')} && rm -rf  /var/lib/{apt,dpkg,cache,log}/`,
      );
    } else {
      return '';
    }
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
    const { user, group, uid, gid } = cfg.dockerRuntime;
    return [
      user !== 'root' ? ifElse(
        'RUN which useradd',
        `groupadd --gid ${gid} ${group} && useradd -u ${uid} -g ${group} ${user}`,
        `addgroup -g ${gid} ${group} && adduser -D -G ${group} -u ${uid} ${user}`
      ) : '',
    ].join('\n');
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
   * Docker app files copied and permissioned
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