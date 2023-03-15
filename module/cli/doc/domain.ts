import { CliCommand } from '@travetto/cli';

@CliCommand()
class DomainCommand {

  verbose = false;

  async main(domain: string, port = 3000) {
    console.log('Launching', { domain, port, verbose: this.verbose });
  }
}