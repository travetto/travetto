import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import rl from 'node:readline/promises';
import net from 'node:net';

import { ExecUtil, TimeUtil, Util } from '@travetto/runtime';

type ServiceStatus = 'started' | 'stopped' | 'starting' | 'downloading' | 'stopping' | 'initializing' | 'failed';

const ports = (val: number | `${number}:${number}`): [number, number] =>
  typeof val === 'number' ?
    [val, val] :
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    val.split(':').map(x => parseInt(x, 10)) as [number, number];

type BodyCheck = (body: string) => boolean;

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
  ready?: { url: string, test?: BodyCheck };
  volumes?: Record<string, string>;
  env?: Record<string, string>;
  startupTimeout?: number;
}

/**
 * Service runner
 */
export class ServiceRunner {

  label: string;

  constructor(public svc: ServiceDescriptor, private emit?: (status: ServiceStatus, type: 'failure' | 'success' | 'message', value: string | number) => void) {
    this.label = `trv-${this.svc.name}`;
  }

  async #isRunning(full = false): Promise<boolean> {

    if (!this.svc.port) {
      return true;
    }

    const port: number = ports(this.svc.port)[0];
    const start = Date.now();
    const timeoutMs = TimeUtil.asMillis(full ? this.svc.startupTimeout ?? 5000 : 100);
    while ((Date.now() - start) < timeoutMs) {
      try {
        const sock = net.createConnection(port, 'localhost');
        await new Promise<void>((res, rej) =>
          sock.on('connect', res).on('timeout', rej).on('error', rej)
        ).finally(() => sock.destroy());

        if (!this.svc.ready?.url) {
          return true;
        } else {
          const req = await fetch(this.svc.ready.url, { method: 'GET' });
          if (req.ok) {
            const text = await req.text();
            if (!full || (this.svc.ready.test?.(text) ?? true)) {
              return true;
            }
          }
        }
      } catch {
        await Util.blockingTimeout(50);
      }
    }

    return false;
  }

  async #findContainer(): Promise<string> {
    return (await ExecUtil.getResult(spawn('docker', ['ps', '-q', '--filter', `label=${this.label}`], { shell: false }))).stdout.trim();
  }

  async #pullImage(): Promise<void> {
    const result = await ExecUtil.getResult(spawn('docker', ['image', 'inspect', this.svc.image], { shell: false }), { catch: true });
    if (result.valid) {
      return;
    }

    const proc = spawn('docker', ['pull', this.svc.image], { stdio: [0, 'pipe', 'pipe'] });
    const output = rl.createInterface(proc.stdout!);
    output.on('line', (line) => {
      this.emit?.('downloading', 'message', `Downloading: ${line}`);
    });
    await ExecUtil.getResult(proc);
  }


  async #isStarted(): Promise<boolean> {
    const port = this.svc.port ? ports(this.svc.port)[0] : 0;
    if (port > 0) {
      try {
        this.emit?.('initializing', 'message', `Waiting for ${this.svc.ready?.url ?? `port ${port}`}...`);
        return await this.#isRunning(true);
      } catch {
        return false;
      }
    }
    return true;
  }

  async stop(): Promise<void> {
    if (await this.#isRunning()) {
      const pid = await this.#findContainer();
      if (pid) {
        this.emit?.('stopping', 'message', 'Stopping');
        await ExecUtil.getResult(spawn('docker', ['kill', pid], { shell: false }));
        this.emit?.('stopped', 'success', 'Stopped');
      } else {
        this.emit?.('failed', 'failure', 'Unable to kill, not started by this script');
      }
    } else {
      this.emit?.('stopped', 'message', 'Skipping, already stopped');
    }
  }

  async start(): Promise<void> {
    if (!await this.#isRunning()) {
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

        this.emit?.('starting', 'message', 'Starting');

        const out = (await ExecUtil.getResult(spawn('docker', args, { shell: false, stdio: [0, 'pipe', 2] }))).stdout;

        const running = await this.#isStarted();
        if (!running) {
          this.emit?.('failed', 'failure', 'Failed to start service correctly');
        } else {
          this.emit?.('started', 'success', `Started ${out.substring(0, 12)}`);
        }
      } catch {
        this.emit?.('failed', 'failure', 'Failed to run docker');
      }
    } else {
      this.emit?.('started', 'message', 'Skipping, already running');
    }
  }

  async restart(): Promise<void> {
    if (await this.#isRunning()) {
      await this.stop();
    }
    await this.start();
  }

  async status(): Promise<void> {
    if (!await this.#isRunning()) {
      this.emit?.('stopped', 'message', 'Not running');
    } else {
      const pid = await this.#findContainer();
      if (pid) {
        this.emit?.('started', 'success', `Running ${pid}`);
      } else {
        this.emit?.('started', 'message', 'Running, but not managed');
      }
    }
  }
}