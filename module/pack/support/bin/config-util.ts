import { DockerPackConfig } from './types';

/**
 * Common utils for setting up pack config
 */
export class PackConfigUtil {
  /**
   * Generate a docker user creation command
   */
  static dockerUserCommand(cfg: DockerPackConfig): string {
    const { user, group, uid, gid } = cfg.dockerRuntimeUser;
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
}