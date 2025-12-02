import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import rl from 'node:readline/promises';
import net from 'node:net';

import { ExecUtil, TimeUtil, Util } from '@travetto/runtime';

const ports = (value: number | `${number}:${number}`): [number, number] =>
  typeof value === 'number' ?
    [value, value] :
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    value.split(':').map(x => parseInt(x, 10)) as [number, number];

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

export type ServiceAction = 'start' | 'stop' | 'status' | 'restart';

/**
 * Service runner
 */
export class ServiceRunner {

  svc: ServiceDescriptor;
  constructor(svc: ServiceDescriptor) { this.svc = svc; }

  async #isRunning(full = false): Promise<boolean> {
    const port = ports(this.svc.port!)[0];
    const start = Date.now();
    const timeoutMs = TimeUtil.asMillis(full ? this.svc.startupTimeout ?? 5000 : 100);
    while ((Date.now() - start) < timeoutMs) {
      try {
        const sock = net.createConnection(port, 'localhost');
        await new Promise<void>((resolve, reject) =>
          sock.on('connect', resolve).on('timeout', reject).on('error', reject)
        ).finally(() => sock.destroy());

        if (!this.svc.ready?.url || !full) {
          return true;
        } else {
          const response = await fetch(this.svc.ready.url, { method: 'GET' });
          const text = await response.text();
          if (response.ok && (this.svc.ready.test?.(text) ?? true)) {
            return true;
          }
        }
      } catch {
        await Util.blockingTimeout(50);
      }
    }

    return false;
  }

  async #hasImage(): Promise<boolean> {
    const result = await ExecUtil.getResult(spawn('docker', ['image', 'inspect', this.svc.image]), { catch: true });
    return result.valid;
  }

  async * #pullImage(): AsyncIterable<string> {
    const subProcess = spawn('docker', ['pull', this.svc.image], { stdio: [0, 'pipe', 'pipe'] });
    yield* rl.createInterface(subProcess.stdout!);
    await ExecUtil.getResult(subProcess);
  }

  async #startContainer(): Promise<string> {
    const args = [
      'run',
      '--rm',
      '--detach',
      ...this.svc.privileged ? ['--privileged'] : [],
      '--label', `trv-${this.svc.name}`,
      ...Object.entries(this.svc.env ?? {}).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
      ...this.svc.port ? ['-p', ports(this.svc.port).join(':')] : [],
      ...Object.entries(this.svc.volumes ?? {}).flatMap(([key, value]) => ['--volume', `${key}:${value}`]),
      this.svc.image,
      ...this.svc.args ?? [],
    ];

    for (const item of Object.keys(this.svc.volumes ?? {})) {
      await fs.mkdir(item, { recursive: true });
    }

    return (await ExecUtil.getResult(spawn('docker', args, { stdio: [0, 'pipe', 2] }))).stdout;
  }

  async #getContainerId(): Promise<string | undefined> {
    return (await ExecUtil.getResult(spawn('docker', ['ps', '-q', '--filter', `label=trv-${this.svc.name}`]))).stdout.trim();
  }

  async #killContainer(cid: string): Promise<void> {
    await ExecUtil.getResult(spawn('docker', ['kill', cid]));
  }

  async * action(operation: ServiceAction): AsyncIterable<['success' | 'failure' | 'message', string]> {
    try {
      const cid = await this.#getContainerId();
      const port = this.svc.port ? ports(this.svc.port)[0] : 0;
      const running = !!cid && (!port || await this.#isRunning());

      if (running && !cid) { // We don't own
        return yield [operation === 'status' ? 'message' : 'failure', 'Running but not managed'];
      }

      if (operation === 'status') {
        return yield !cid ? ['message', 'Not running'] : ['success', `Running ${cid}`];
      } else if (operation === 'start' && running) {
        return yield ['message', 'Skipping, already running'];
      } else if (operation === 'stop' && !running) {
        return yield ['message', 'Skipping, already stopped'];
      }

      if (running && (operation === 'restart' || operation === 'stop')) {
        yield ['message', 'Stopping'];
        await this.#killContainer(cid);
        yield ['success', 'Stopped'];
      }

      if (operation === 'restart' || operation === 'start') {
        if (!await this.#hasImage()) {
          yield ['message', 'Starting image download'];
          for await (const line of await this.#pullImage()) {
            yield ['message', `Downloading: ${line}`];
          }
          yield ['message', 'Image download complete'];
        }

        yield ['message', 'Starting'];
        const out = await this.#startContainer();

        if (port) {
          yield ['message', `Waiting for ${this.svc.ready?.url ?? 'container'}...`];
          if (!await this.#isRunning(true)) {
            yield ['failure', 'Failed to start service correctly'];
          }
        }
        yield ['success', `Started ${out.substring(0, 12)}`];
      }
    } catch {
      yield ['failure', 'Failed to start'];
    }
  }
}