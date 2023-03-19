import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand } from '@travetto/cli';

/** Test child worker target */
@CliCommand({ hidden: true })
export class TestChildWorkerCommand {
  envInit(): GlobalEnvConfig {
    return { test: true, set: { FORCE_COLOR: 0 } };
  }

  async main(): Promise<void> {
    const { TestChildWorker } = await import('../src/worker/child.js');
    return new TestChildWorker().activate();
  }
}