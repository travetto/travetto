import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import rl from 'node:readline/promises';
import net from 'node:net';

import { ExecUtil, TimeUtil, Util } from '@travetto/runtime';

const ports = (value: number | `${number}:${number}`): [number, number] =>
  typeof value === 'number' ?
    [value, value] :
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    value.split(':').map(number => parseInt(number, 10)) as [number, number];

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

  #descriptor: ServiceDescriptor;
  constructor(descriptor: ServiceDescriptor) { this.#descriptor = descriptor; }

  async #isRunning(full = false): Promise<boolean> {
    const port = ports(this.#descriptor.port!)[0];
    const start = Date.now();
    const timeoutMs = TimeUtil.duration(full ? this.#descriptor.startupTimeout ?? 5000 : 100, 'ms');
    while ((Date.now() - start) < timeoutMs) {
      try {
        const sock = net.createConnection(port, 'localhost');
        await new Promise<void>((resolve, reject) =>
          sock.on('connect', resolve).on('timeout', reject).on('error', reject)
        ).finally(() => sock.destroy());

        if (!this.#descriptor.ready?.url || !full) {
          return true;
        } else {
          const response = await fetch(this.#descriptor.ready.url, { method: 'GET' });
          const text = await response.text();
          if (response.ok && (this.#descriptor.ready.test?.(text) ?? true)) {
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
    const result = await ExecUtil.getResult(spawn('docker', ['image', 'inspect', this.#descriptor.image]), { catch: true });
    return result.valid;
  }

  async * #pullImage(): AsyncIterable<string> {
    const subProcess = spawn('docker', ['pull', this.#descriptor.image], { stdio: [0, 'pipe', 'pipe'] });
    yield* rl.createInterface(subProcess.stdout!);
    await ExecUtil.getResult(subProcess);
  }

  async #startContainer(): Promise<string> {
    const args = [
      'run',
      '--rm',
      '--detach',
      ...this.#descriptor.privileged ? ['--privileged'] : [],
      '--label', `trv-${this.#descriptor.name}`,
      ...Object.entries(this.#descriptor.env ?? {}).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
      ...this.#descriptor.port ? ['-p', ports(this.#descriptor.port).join(':')] : [],
      ...Object.entries(this.#descriptor.volumes ?? {}).flatMap(([key, value]) => ['--volume', `${key}:${value}`]),
      this.#descriptor.image,
      ...this.#descriptor.args ?? [],
    ];

    for (const item of Object.keys(this.#descriptor.volumes ?? {})) {
      await fs.mkdir(item, { recursive: true });
    }

    return (await ExecUtil.getResult(spawn('docker', args, { stdio: [0, 'pipe', 2] }))).stdout;
  }

  async #getContainerId(): Promise<string | undefined> {
    return (await ExecUtil.getResult(spawn('docker', ['ps', '-q', '--filter', `label=trv-${this.#descriptor.name}`]))).stdout.trim();
  }

  async #killContainer(containerId: string): Promise<void> {
    await ExecUtil.getResult(spawn('docker', ['kill', containerId]));
  }

  async * action(operation: ServiceAction): AsyncIterable<['success' | 'failure' | 'message', string]> {
    try {
      const containerId = await this.#getContainerId();
      const port = this.#descriptor.port ? ports(this.#descriptor.port)[0] : 0;
      const running = !!containerId && (!port || await this.#isRunning());

      if (running && !containerId) { // We don't own
        return yield [operation === 'status' ? 'message' : 'failure', 'Running but not managed'];
      }

      if (operation === 'status') {
        return yield !containerId ? ['message', 'Not running'] : ['success', `Running ${containerId}`];
      } else if (operation === 'start' && running) {
        return yield ['message', 'Skipping, already running'];
      } else if (operation === 'stop' && !running) {
        return yield ['message', 'Skipping, already stopped'];
      }

      if (running && (operation === 'restart' || operation === 'stop')) {
        yield ['message', 'Stopping'];
        await this.#killContainer(containerId);
        yield ['success', 'Stopped'];
      }

      if (operation === 'restart' || operation === 'start') {
        if (!await this.#hasImage()) {
          yield ['message', 'Starting image download'];
          for await (const line of this.#pullImage()) {
            yield ['message', `Downloading: ${line}`];
          }
          yield ['message', 'Image download complete'];
        }

        yield ['message', 'Starting'];
        const out = await this.#startContainer();

        if (port) {
          yield ['message', `Waiting for ${this.#descriptor.ready?.url ?? 'container'}...`];
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