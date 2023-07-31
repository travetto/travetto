import { DockerPackConfig } from './types';

/**
 * Common utils for setting up pack config
 */
export class PackConfigUtil {
  /**
   * Docker setup
   */
  static dockerSetup(cfg: DockerPackConfig): string {
    return [
      `FROM ${cfg.dockerImage}`,
      `WORKDIR /${cfg.dockerRuntime.folder}`,
    ].join('\n');
  }

  /**
   * Generate a docker user creation command
   */
  static dockerUserCommand(cfg: DockerPackConfig): string {
    const { user, group, uid, gid } = cfg.dockerRuntime;
    if (user !== 'root') {
      return [
        '',
        `RUN which addgroup && \
  ( addgroup -g ${gid} ${group} && adduser -S -u ${uid} ${user} ${group} ) || \
  ( groupadd -g ${gid} ${group} && useradd -r -u ${uid} -g ${group} ${user} )`,
        `USER ${user}`
      ].join('\n');
    } else {
      return '';
    }
  }

  /**
   * Expose ports
   */
  static dockerExposePorts(cfg: DockerPackConfig): string {
    return cfg.dockerPort?.map(x => `EXPOSE ${x}`).join('\n') ?? '';
  }

  /**
   * Copy workspace contents
   */
  static dockerCopyWorkspace(cfg: DockerPackConfig): string {
    return `COPY --chown="${cfg.dockerRuntime.user}:${cfg.dockerRuntime.group}" . .`;
  }

  /**
   * Entrypoint creation for a docker configuration
   */
  static dockerEntrypoint(cfg: DockerPackConfig): string {
    return `ENTRYPOINT ["/${cfg.dockerRuntime.folder}/${cfg.mainName}.sh"]`;
  }
}