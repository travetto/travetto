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

  constructor(src: Readable) {
    this.#src = src;
    this.#src.on('close', () => this.#done.resolve());
    this.#listen();
  }

  async #listen(): Promise<void> {
    this.#done.then(() => this.#output.end());

    for await (const d of this.#src) {
      if (this.#isCapture !== false) {
        this.#captured.push(Buffer.from(d));
      }
      if (this.#isStream !== false) {
        this.#output.write(d, this.#src.readableEncoding!);
      }
    }
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

  get output(): Promise<Buffer | undefined> {
    this.#isCapture ??= true;
    return this.#done.then(v => this.#isCapture ? Buffer.concat(this.#captured) : undefined);
  }

  get outputString(): Promise<string | undefined> {
    return this.output.then(v => v?.toString('utf8'));
  }
}

type SpawnResult = { code: number, message?: string, valid: boolean, proc: EnhancedSpawn, stdout?: string, stderr?: string };
type EnhancedSpawn = Omit<ChildProcess, 'stderr' | 'stdout'> & {
  channel: {
    out?: SpawnOutput;
    err?: SpawnOutput;
  };
  result: Promise<SpawnResult>;
  success: Promise<SpawnResult>;
};

export class Spawn {
  static exec(cmd: string, args?: string[], opts?: SpawnOptions): EnhancedSpawn {
    const proc = spawn(cmd, args ?? [], opts ?? {});
    let res: EnhancedSpawn | undefined = undefined;
    let out: SpawnOutput | undefined = undefined;
    let err: SpawnOutput | undefined = undefined;

    const prom = new Promise<{ code: number, message?: string }>((resolve) => {
      proc.on('error', (e: Error) => resolve({ code: 1, message: e.message }));
      proc.on('close', (code: number) => resolve({ code }));
    }).then(async v => ({
      ...v,
      proc: res!,
      valid: !v.code,
      stdout: await out?.outputString,
      stderr: await err?.outputString
    }));

    err = proc.stderr ? new SpawnOutput(proc.stderr) : undefined;
    out = proc.stdout ? new SpawnOutput(proc.stdout) : undefined;

    // eslint-disable-next-line prefer-const
    res = Object.assign(proc, {
      result: prom,
      success: prom.then(v => {
        if (!v.valid) { throw new Error(v.message ?? `Execution failure - ${v.code}`); }
        else { return res!; }
      }),
      channel: {
        out,
        err,
        get outString() { return out?.outputString; },
        get errString() { return err?.outputString; }
      }
    });

    return res!;
  }
}