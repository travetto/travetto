import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import rl from 'node:readline/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

import { AppError, ExecUtil, TimeSpan, TimeUtil, Util } from '@travetto/runtime';

import { cliTpl } from './color';

type ServiceRunningMode = 'running' | 'startup';
type ServiceStatus = 'started' | 'stopped' | 'starting' | 'downloading' | 'stopping' | 'initializing' | 'failed';
type ServiceEvent = { statusText: string, status: ServiceStatus, svc: ServiceDescriptor, idx: number };

const ports = (val: number | `${number}:${number}`): [number, number] =>
  typeof val === 'number' ?
    [val, val] :
    val.split(':').map(x => parseInt(x, 10)) as [number, number];

/**
 * This represents the schema for defined services
 */
export interface ServiceDescriptor {
  name: string;
  version: string | number;
  port?: number | `${number}:${number}`;
  privileged?: boolean;
  image: string;
  args?: string[];
  ready?: { url: string, test?(body: string): boolean };
  volumes?: Record<string, string>;
  env?: Record<string, string>;
  startupTimeout?: number;
}

/**
 * Service runner
 */
export class ServiceRunner extends EventEmitter<{ log: [ServiceEvent] }> {

  static async waitForHttp(url: URL | string, timeout: TimeSpan | number = '5s'): Promise<string> {
    const parsed = typeof url === 'string' ? new URL(url) : url;
    const ssl = parsed.protocol === 'https:';

    const timeoutMs = TimeUtil.asMillis(timeout);
    const port = parseInt(parsed.port || (ssl ? '443' : '80'), 10);
    await this.waitForPort(port, timeoutMs);

    const start = Date.now();
    while ((Date.now() - start) < timeoutMs) {
      const [status, body] = await new Promise<[number, string]>((resolve) => {
        const data: Buffer[] = [];
        const res = (s: number): void => resolve([s, Buffer.concat(data).toString('utf8')]);
        try {
          const client = ssl ? https : http;
          const req = client.get(url, (msg) =>
            msg
              .on('data', (d) => { data.push(Buffer.from(d)); }) // Consume data
              .on('error', (err) => res(500))
              .on('end', () => res((msg.statusCode || 200)))
              .on('close', () => res((msg.statusCode || 200))));
          req.on('error', (err) => res(500));
        } catch {
          res(400);
        }
      });
      if (status >= 200 && status <= 299) {
        return body; // We good
      }
      await Util.blockingTimeout(100);
    }
    throw new AppError('Could not make http connection to url');
  }

  static async waitForPort(port: number, timeout: TimeSpan | number = '5s'): Promise<void> {
    const start = Date.now();
    const timeoutMs = TimeUtil.asMillis(timeout);
    while ((Date.now() - start) < timeoutMs) {
      try {
        await new Promise((res, rej) => {
          try {
            const sock = net.createConnection(port, 'localhost')
              .on('connect', res)
              .on('connect', () => sock.destroy())
              .on('timeout', rej)
              .on('error', rej);
          } catch (err) {
            rej(err);
          }
        });
        return;
      } catch {
        await Util.blockingTimeout(50);
      }
    }
    throw new AppError('Could not acquire port');
  }

  label: string;

  constructor(public idx: number, public svc: ServiceDescriptor) {
    super();
    this.label = `trv-${this.svc.name}`;
  }

  #log(status: ServiceStatus, statusText: Record<string, string | number>): void {
    this.emit('log', { idx: this.idx, svc: this.svc, status, statusText: cliTpl`${statusText}` });
  }

  async #findContainer(): Promise<string> {
    return (await ExecUtil.getResult(spawn('docker', ['ps', '-q', '--filter', `label=${this.label}`], { shell: false }))).stdout.trim();
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
    const port = this.svc.port ? ports(this.svc.port)[0] : 0;
    if (port > 0) {
      const checkPort = ServiceRunner.waitForPort(port, timeout).then(() => true, () => false);
      if (mode === 'startup') {
        this.#log('initializing', { input: `Waiting for port ${port}...` });

        let res = await checkPort;
        if (res && this.svc.ready) {
          try {
            this.#log('initializing', { input: `Waiting for url ${this.svc.ready.url}...` });
            const body = await ServiceRunner.waitForHttp(this.svc.ready.url, timeout);
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
    const preRun = await this.#isRunning('running');
    if (!preRun) {
      try {
        const args = [
          'run',
          '--rm',
          '--detach',
          ...this.svc.privileged ? ['--privileged'] : [],
          '--label', this.label,
          ...Object.entries(this.svc.env ?? {}).flatMap(([k, v]) => ['--env', `${k}=${v}`]),
          ...this.svc.port ? ['-p', ports(this.svc.port).join(':')] : [],
          ...Object.entries(this.svc.volumes ?? {}).flatMap(([k, v]) => ['--volume', `${k}:${v}`]),
          this.svc.image,
          ...this.svc.args ?? [],
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