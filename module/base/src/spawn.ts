import { ChildProcess, SpawnOptions, spawn } from 'node:child_process';
import { PassThrough, Readable } from 'node:stream';
import { Util } from './util';

export class SpawnOutput {
  #src: Readable;
  #captured: Buffer[] = [];
  #output = new PassThrough();
  #isStream: boolean | undefined;
  #isCapture: boolean | undefined;
  #done = Util.resolvablePromise();
  #received = 0;

  constructor(src: Readable) {
    this.#src = src;
    this.#src.on('close', () => this.#done.resolve());
    this.#listen();
  }

  async #listen(): Promise<void> {
    this.#done.then(() => this.#output.end());

    for await (const d of this.#src) {
      this.#received += d.length;
      if (this.#isCapture !== false) {
        this.#captured.push(Buffer.from(d));
      }
      if (this.#isStream !== false) {
        this.#output.write(d, this.#src.readableEncoding!);
      }
    }
  }

  get received(): number {
    return this.#received;
  }

  noCapture(): SpawnOutput {
    this.#isCapture ??= false;
    this.#captured = this.#isCapture ? this.#captured : [];
    return this;
  }

  get stream(): Readable | undefined {
    this.#isStream ??= true;
    return this.#isStream ? this.#output : undefined;
  }

  get rawOutput(): Buffer | undefined {
    return Buffer.concat(this.#captured);
  }

  get output(): Promise<Buffer | undefined> {
    this.#isCapture ??= true;
    return this.#done.then(v => this.#isCapture ? this.rawOutput : undefined);
  }

  get outputString(): Promise<string | undefined> {
    return this.output.then(v => v?.toString('utf8'));
  }
}

export type SpawnResult = { exitCode: number, errMessage?: string, valid: boolean, spawn: EnhancedSpawn, stdout?: string, stderr?: string };
export type EnhancedSpawn = {
  stdout?: SpawnOutput;
  stderr?: SpawnOutput;
  raw: ChildProcess;
  result: Promise<SpawnResult>;
  success: Promise<SpawnResult>;
  kill: () => void;
};

export class Spawn {
  static exec(cmd: string, args?: string[], opts?: SpawnOptions): EnhancedSpawn {
    const proc = spawn(cmd, args ?? [], opts ?? {});
    let res: EnhancedSpawn | undefined = undefined;
    let stdout: SpawnOutput | undefined = undefined;
    let stderr: SpawnOutput | undefined = undefined;

    const prom = new Promise<{ valid: Boolean, exitCode: number, errMessage?: string }>((resolve) => {
      proc.on('error', (e: Error) => resolve({ exitCode: proc.exitCode ?? 0, valid: false, errMessage: e.message }));
      proc.on('close', (exitCode: number) => resolve({ exitCode, valid: !exitCode }));
    }).then(async v => ({
      ...v,
      spawn: res!,
      valid: !v.exitCode,
      stdout: await stdout?.outputString,
      stderr: await stderr?.outputString
    }));

    stderr = proc.stderr ? new SpawnOutput(proc.stderr) : undefined;
    stdout = proc.stdout ? new SpawnOutput(proc.stdout) : undefined;

    // eslint-disable-next-line prefer-const
    res = {
      kill: () => process.kill(proc.pid!, ...(process.platform === 'win32' ? [] : ['SIGTERM'])),
      result: prom,
      raw: proc,
      get success(): Promise<SpawnResult> {
        return prom.then(v => {
          if (!v.valid) { throw new Error(v.errMessage ?? `Execution failure - ${v.exitCode}`); }
          else { return v; }
        });
      },
      stdout,
      stderr
    };

    return res!;
  }
}