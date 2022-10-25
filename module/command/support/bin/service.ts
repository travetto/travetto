import { ModuleIndex } from '@travetto/manifest';
import { CliUtil } from '@travetto/boot/src/cli';

export type StreamingResult = Partial<Record<keyof typeof CliUtil['colorPalette'], string | number>>;
export type StreamingStatus = AsyncIterable<StreamingResult>;

export type Service = {
  name: string;
  version: string;
  port?: number;
  ports?: Record<number, number>;
  privileged?: boolean;
  image: string;
  args?: string[];
  ready?: { url: string, test?(body: string): boolean };
  volumes?: Record<string, string>;
  env?: Record<string, string>;
  require?: string;
};

/**
 * Utils for starting up in place services, primarily for development
 */
export class ServiceUtil {

  /**
   * Determine if service is running
   */
  static async * isRunning(svc: Service, mode: 'running' | 'startup', timeout = 100): StreamingStatus {
    const { CommandUtil } = await import('../../src/util');

    const port = svc.ports ? +Object.keys(svc.ports)[0] : (svc.port ?? 0);
    if (port > 0) {
      const checkPort = CommandUtil.waitForPort(port, timeout).then(x => true, x => false);
      if (mode === 'startup') {
        yield { input: `Waiting for port ${port}...` };
        let res = await checkPort;
        if (res && svc.ready) {
          try {
            yield { input: `Waiting for url ${svc.ready.url}...` };
            const body = await CommandUtil.waitForHttp(svc.ready.url, timeout);
            res = svc.ready.test ? svc.ready.test(body) : res;
          } catch {
            res = false;
          }
        }
        return res;
      } else {
        return await checkPort;
      }
    } else {
      return true;
    }
  }

  /**
   * Get container id from docker
   */
  static async getContainerId(svc: Service): Promise<string> {
    const { CommandUtil } = await import('../../src/util');

    return CommandUtil.findContainerByLabel(`trv-${svc.name}`);
  }

  /**
   * Stop a service
   */
  static async * stop(svc: Service): StreamingStatus {
    const { CommandUtil } = await import('../../src/util');

    const running = yield* this.isRunning(svc, 'running');
    if (running) {
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
  static async * start(svc: Service): StreamingStatus {
    const { DockerContainer } = await import('../../src/docker');

    const preRun = yield* this.isRunning(svc, 'running');
    if (!preRun) {
      yield { subtitle: 'Starting' };
      try {
        const container = new DockerContainer(svc.image)
          .setInteractive(true)
          .setDeleteOnFinish(true)
          .setDaemon(true)
          .setPrivileged(svc.privileged)
          .addLabel(`trv-${svc.name}`)
          .addEnvVars(svc.env || {});

        if (svc.ports) {
          for (const [pub, pri] of Object.entries(svc.ports)) {
            container.exposePort(+pub, +pri);
          }
        } else if (svc.port) {
          container.exposePort(svc.port);
        }

        if (svc.volumes) {
          for (const [src, target] of Object.entries(svc.volumes)) {
            container.addVolume(src, target);
          }
        }

        const promise = await container.setUnref(false).run(svc.args ?? []);

        const out = (await promise).stdout;
        const running = yield* this.isRunning(svc, 'startup', 15000);
        if (!running) {
          yield { failure: 'Failed to start service correctly' };
        } else {
          yield { success: `Started ${out.substring(0, 12)}` };
        }
      } catch {
        yield { failure: 'Failed to run docker' };
      }
    } else {
      yield { subsubtitle: 'Skipping, already running' };
    }
  }

  /**
   * Restart service
   * @param svc
   */
  static async * restart(svc: Service): StreamingStatus {
    if (await this.isRunning(svc, 'running')) {
      yield* this.stop(svc);
    }
    yield* this.start(svc);
  }

  /**
   * Get status of a service
   */
  static async * status(svc: Service): StreamingStatus {
    if (!await this.isRunning(svc, 'running')) {
      yield { subsubtitle: 'Not running' };
    } else {
      const pid = await this.getContainerId(svc);
      yield (pid ? { success: `Running ${pid}` } : { subsubtitle: 'Running, but not managed' });
    }
  }

  /**
   * Find all services
   */
  static async findAll(): Promise<Service[]> {
    return (await Promise.all(
      ModuleIndex.findSupport({ filter: x => /\/service[.]/.test(x) })
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map(async x => (await import(x.file)).service as Service)
    ))
      .filter(x => !!x)
      .map(x => {
        x.version = `${x.version}`;
        return x;
      });
  }
}