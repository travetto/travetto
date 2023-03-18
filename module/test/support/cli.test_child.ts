import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand } from '@travetto/cli';
import { TestChildWorker } from '../src/worker/child';

/** Test child worker target */
@CliCommand({ hidden: true })
export class TestChildWorkerCommand {
  envInit(): GlobalEnvConfig {
    return { test: true, set: { FORCE_COLOR: 0 } };
  }

  main(): Promise<void> {
    return new TestChildWorker().activate();
  }
}