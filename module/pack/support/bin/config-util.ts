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
   * Common docker environment setup
   */
  static dockerWorkspace(cfg: DockerPackConfig): string {
    const { folder, user, group, uid, gid } = cfg.dockerRuntime;
    return [
      ...cfg.dockerPort?.map(x => `EXPOSE ${x}`) ?? [],
      user !== 'root' ? ifElse(
        'RUN which addgroup',
        `addgroup -g ${gid} ${group} && adduser -S -u ${uid} ${user} ${group}`,
        `groupadd -g ${gid} ${group} && useradd -r -u ${uid} -g ${group} ${user}`
      ) : '',
      `RUN mkdir ${folder} && chown ${user}:${group} ${folder}`,
      `USER ${user}`,
      `WORKDIR ${folder}`,
      `COPY --chown="${user}:${group}" . .`,
    ].join('\n');
  }

  /**
   * Entrypoint creation for a docker configuration
   */
  static dockerEntrypoint(cfg: DockerPackConfig): string {
    return `ENTRYPOINT ["${cfg.dockerRuntime.folder}/${cfg.mainName}.sh"]`;
  }
}