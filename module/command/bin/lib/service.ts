import { EnvUtil } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';
import { CommandUtil } from '../../src/util';
import { DockerContainer } from '../../src/docker';

export type Service = { name: string, version: string, port: number, image: string, env?: Record<string, string> };

/**
 * Utils for starting up in place services, primarily for development
 */
export class ServiceUtil {

  /**
   * Determine if service is running
   */
  static async isRunning(svc: Service, timeout = 100) {
    return CommandUtil.waitForPort(svc.port, timeout).then(x => true, x => false);
  }

  /**
   * Get container id from docker
   */
  static async getContainerId(svc: Service) {
    return CommandUtil.findContainerByLabel(`trv-${svc.name}`);
  }

  /**
   * Stop a service
   */
  static async * stop(svc: Service) {
    if (await this.isRunning(svc)) {
      const pid = await this.getContainerId(svc);
      if (pid) {
        yield { subtitle: 'Stopping' };
        await CommandUtil.killContainerById(pid);
        yield { success: 'Stopped' };
      } else {
        yield { failure: 'Unable to kill, not started by this script' };
      }
    } else {
      yield { subsubtitle: 'Skipping, already stopped' };
    }
  }

  /**
   * Start a service
   */
  static async * start(svc: Service) {
    if (!(await this.isRunning(svc))) {
      yield { subtitle: 'Starting' };
      const promise = new DockerContainer(svc.image)
        .setInteractive(true)
        .setDeleteOnFinish(true)
        .setDaemon(true)
        .exposePort(svc.port)
        .addLabel(`trv-${svc.name}`)
        .addEnvVars(svc.env || {})
        .run();

      const out = (await promise).stdout;
      if (!await this.isRunning(svc, 15000)) {
        yield { failure: 'Failed to start service correctly' };
      } else {
        yield { success: `Started ${out.substring(0, 12)}` };
      }
    } else {
      yield { subsubtitle: 'Skipping, already running' };
    }
  }

  /**
   * Restart service
   * @param svc
   */
  static async * restart(svc: Service) {
    if (await this.isRunning(svc)) {
      yield* this.stop(svc);
    }
    yield* this.start(svc);
  }

  /**
   * Get status of a service
   */
  static async * status(svc: Service) {
    if (!await this.isRunning(svc)) {
      yield { subsubtitle: 'Not running' };
    } else {
      const pid = await this.getContainerId(svc);
      yield (pid ? { success: `Running ${pid}` } : { subsubtitle: 'Running, but not managed' });
    }
  }

  /**
   * Find all services
   */
  static findAll() {
    const extra = EnvUtil.getList('TRV_SVC_FILES');
    const all = FrameworkUtil
      .scan(x => /support\/service[.].*?[.]json/.test(x))
      .filter(x => x.stats.isFile())
      .map(x => require(x.file) as Service);

    for (const e of extra) {
      all.push(require(e) as Service);
    }

    return all;
  }
}