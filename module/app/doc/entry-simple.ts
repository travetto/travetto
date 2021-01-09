import { Injectable, Inject } from '@travetto/di';
import { Application } from '@travetto/app';

@Injectable()
class Server {
  name = 'roger';

  async launch() {
    // ...
  }
}

@Application('simple')
class SimpleApp {

  @Inject()
  server: Server;

  async run() {
    return this.server.launch();
  }
}