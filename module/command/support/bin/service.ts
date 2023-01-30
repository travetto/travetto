import { RootIndex } from '@travetto/manifest';
import { Util } from '@travetto/base';
import { cliTpl } from '@travetto/cli';

import { CommandUtil } from '../../src/util';
import { DockerContainer } from '../../src/docker';

export const SERVICE_ACTIONS = ['start', 'stop', 'status', 'restart'] as const;
export type ServiceAction = (typeof SERVICE_ACTIONS)[number];
export type ServiceStatus = 'started' | 'stopped' | 'starting' | 'stopping' | 'initializing' | 'failed';
export type ServiceEvent = { statusText: string, status: ServiceStatus };
export type ServicesEvent = ServiceEvent & { svc: Service, idx: number };

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

function event(status: ServiceStatus, statusText: Record<string, string | number>): ServiceEvent {
  return { status, statusText: cliTpl`${statusText}` };
}

/**
 * Utils for starting up in place services, primarily for development
 */
export class ServiceUtil {

  /**
   * Determine if service is running
   */
  static async * isRunning(svc: Service, mode: 'running' | 'startup', timeout = 100): AsyncIterable<ServiceEvent> {
    const port = svc.ports ? +Object.keys(svc.ports)[0] : (svc.port ?? 0);
    if (port > 0) {
      const checkPort = CommandUtil.waitForPort(port, timeout).then(x => true, x => false);
      if (mode === 'startup') {
        yield event('initializing', { input: `Waiting for port ${port}...` });

        let res = await checkPort;
        if (res && svc.ready) {
          try {
            yield event('initializing', { input: `Waiting for url ${svc.ready.url}...` });
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
    return CommandUtil.findContainerByLabel(`trv-${svc.name}`);
  }

  /**
   * Stop a service
   */
  static async * stop(svc: Service): AsyncIterable<ServiceEvent> {
    const running = yield* this.isRunning(svc, 'running');
    if (running) {
      const pid = await this.getContainerId(svc);
      if (pid) {
        yield event('stopping', { subtitle: 'Stopping' });
        await CommandUtil.killContainerById(pid);
        yield event('stopped', { success: 'Stopped' });
      } else {
        yield event('failed', { failure: 'Unable to kill, not started by this script' });
      }
    } else {
      yield event('stopped', { subsubtitle: 'Skipping, already stopped' });
    }
  }

  /**
   * Start a service
   */
  static async * start(svc: Service): AsyncIterable<ServiceEvent> {
    const preRun = yield* this.isRunning(svc, 'running');
    if (!preRun) {
      yield event('starting', { subtitle: 'Starting' });
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
          yield event('failed', { failure: 'Failed to start service correctly' });
        } else {
          yield event('started', { success: `Started ${out.substring(0, 12)}` });
        }
      } catch {
        yield event('failed', { failure: 'Failed to run docker' });
      }
    } else {
      yield event('started', { subsubtitle: 'Skipping, already running' });
    }
  }

  /**
   * Restart service
   * @param svc
   */
  static async * restart(svc: Service): AsyncIterable<ServiceEvent> {
    const running = yield* this.isRunning(svc, 'running');
    if (running) {
      yield* this.stop(svc);
    }
    yield* this.start(svc);
  }

  /**
   * Get status of a service
   */
  static async * status(svc: Service): AsyncIterable<ServiceEvent> {
    const running = yield* this.isRunning(svc, 'running');
    if (!running) {
      yield event('stopped', { subsubtitle: 'Not running' });
    } else {
      const pid = await this.getContainerId(svc);
      yield event('started', (pid ? { success: `Running ${pid}` } : { subsubtitle: 'Running, but not managed' }));
    }
  }

  /**
   * Find all services
   */
  static async findAll(): Promise<Service[]> {
    return (await Promise.all(
      RootIndex.findSupport({ filter: x => /\/service[.]/.test(x) })
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map(async x => (await import(x.output)).service as Service)
    ))
      .filter(x => !!x)
      .map(x => {
        x.version = `${x.version}`;
        return x;
      });
  }

  /**
   * Trigger services
   */
  static async * triggerServices(action: ServiceAction, services: Service[]): AsyncIterable<ServicesEvent> {
    const active = new Set<number>();
    const updates: ServicesEvent[] = [];
    let signal = Util.resolvablePromise();

    const drain = async (idx: number): Promise<void> => {
      active.add(idx);
      const svc = services[idx];
      for await (const ev of await this[action](svc)) {
        updates.push({ ...ev, svc, idx });
        signal.resolve();
      }
      active.delete(idx);
    };

    for (let i = 0; i < services.length; i += 1) {
      drain(i);
    }

    while (active.size) {
      await (signal = Util.resolvablePromise());
      yield* updates.splice(0, updates.length);
    }
  }
}