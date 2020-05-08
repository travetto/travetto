import { Application, AppUtil } from '@travetto/app';
import { WebServer } from '@travetto/cli/src/http';
import { EmailServerApp } from '../bin/lib/server';

@Application('email-dev')
class EntryPoint {

  run(port = 3839, reloadRate = 1000) {
    const server = new WebServer({
      handler: EmailServerApp.getHandler(),
      port,
      open: true,
      reloadRate
    });

    const http = server.start();
    return AppUtil.listenToCloseable(http);
  }

}