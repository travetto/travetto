import { CliCommand } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';
import { RestApplication } from '@travetto/rest';

@CliCommand()
export class SampleApp {
  main() {
    // Configure server before running
    return DependencyRegistry.runInstance(RestApplication);
  }
}