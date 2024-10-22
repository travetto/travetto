import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import rl from 'node:readline/promises';

import { ExecUtil } from '@travetto/runtime';

import { CliUtil, } from '../../src/util';
import { ServiceDescriptor } from '../../src/service';
import { cliTpl } from '../../src/color';

type ServiceRunningMode = 'running' | 'startup';
type ServiceStatus = 'started' | 'stopped' | 'starting' | 'downloading' | 'stopping' | 'initializing' | 'failed';
type ServiceEvent = { statusText: string, status: ServiceStatus, svc: ServiceDescriptor, idx: number };

/**
 * Service wrapper
 */
export class ServiceWrapper extends EventEmitter<{ log: [ServiceEvent] }> {

  constructor(public idx: number, public svc: ServiceDescriptor) {
    super();
    this.svc.label = `trv-${this.svc.name}`;
  }

  #log(status: ServiceStatus, statusText: Record<string, string | number>): void {
    this.emit('log', { idx: this.idx, svc: this.svc, status, statusText: cliTpl`${statusText}` });
  }

  async #findContainer(): Promise<string> {
    return (await ExecUtil.getResult(spawn('docker', ['ps', '-q', '--filter', `label=${this.svc.label}`], { shell: false }))).stdout.trim();
  }

  async #pullImage(): Promise<void> {
    const result = await ExecUtil.getResult(spawn('docker', ['image', 'inspect', this.svc.image]), { catch: true });
    if (result.valid) {
      return;
    }

    const proc = spawn('docker', ['pull', this.svc.image], { stdio: [0, 'pipe', 'pipe'] });
    const output = rl.createInterface(proc.stdout!);
    output.on('line', (line) => {
      this.#log('downloading', { subtitle: `Downloading: ${line}` });
    });
    await ExecUtil.getResult(proc);
  }

  async #isRunning(mode: ServiceRunningMode, timeout = 100): Promise<boolean> {
    const port = this.svc.ports ? +Object.keys(this.svc.ports)[0] : (this.svc.port ?? 0);
    if (port > 0) {
      const checkPort = CliUtil.waitForPort(port, timeout).then(() => true, () => false);
      if (mode === 'startup') {
        this.#log('initializing', { input: `Waiting for port ${port}...` });

        let res = await checkPort;
        if (res && this.svc.ready) {
          try {
            this.#log('initializing', { input: `Waiting for url ${this.svc.ready.url}...` });
            const body = await CliUtil.waitForHttp(this.svc.ready.url, timeout);
            res = this.svc.ready.test ? this.svc.ready.test(body) : res;
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

  async stop(): Promise<void> {
    const running = await this.#isRunning('running');
    if (running) {
      const pid = await this.#findContainer();
      if (pid) {
        this.#log('stopping', { subtitle: 'Stopping' });
        await ExecUtil.getResult(spawn('docker', ['kill', pid], { shell: false }));
        this.#log('stopped', { success: 'Stopped' });
      } else {
        this.#log('failed', { failure: 'Unable to kill, not started by this script' });
      }
    } else {
      this.#log('stopped', { subsubtitle: 'Skipping, already stopped' });
    }
  }

  async start(): Promise<void> {
    const preRun = this.#isRunning('running');
    if (!preRun) {
      try {
        const args = [
          '-it',
          '--rm',
          '--detach',
          ...this.svc.privileged ? ['--privileged'] : [],
          '--label', this.svc.label!,
          ...Object.entries(this.svc.env ?? {}).flatMap(([k, v]) => ['--env', `${k}=${v}`]),
          ...Object.entries(this.svc.ports ?? {}).flatMap(([k, v]) => ['--expose', `${k}:${v}`]),
          ...(this.svc.port ? ['--expose', `${this.svc.port}:${this.svc.port}`] : []),
          ...Object.entries(this.svc.volumes ?? {}).flatMap(([k, v]) => ['--volume', `${k}:${v}`])
        ];

        for (const item of Object.keys(this.svc.volumes ?? {})) {
          await fs.mkdir(item, { recursive: true });
        }

        await this.#pullImage();

        this.#log('starting', { subtitle: 'Starting' });

        const out = (await ExecUtil.getResult(spawn('docker', args, { shell: false, stdio: [0, 'pipe', 2] }))).stdout;

        const running = this.#isRunning('startup', this.svc.startupTimeout ?? 5000);
        if (!running) {
          this.#log('failed', { failure: 'Failed to start service correctly' });
        } else {
          this.#log('started', { success: `Started ${out.substring(0, 12)}` });
        }
      } catch {
        this.#log('failed', { failure: 'Failed to run docker' });
      }
    } else {
      this.#log('started', { subsubtitle: 'Skipping, already running' });
    }
  }

  async restart(): Promise<void> {
    const running = await this.#isRunning('running');
    if (running) {
      await this.stop();
    }
    await this.start();
  }

  async status(): Promise<void> {
    const running = await this.#isRunning('running');
    if (!running) {
      this.#log('stopped', { subsubtitle: 'Not running' });
    } else {
      const pid = await this.#findContainer();
      this.#log('started', (pid ? { success: `Running ${pid}` } : { subsubtitle: 'Running, but not managed' }));
    }
  }
}