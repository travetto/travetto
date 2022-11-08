import { Controller, Get, Produces, Request } from '@travetto/rest';
import { ResourceManager } from '@travetto/base';

@Controller('/ui')
export class UIController {

  @Get('/')
  @Produces('text/html')
  getHomepage() {
    return ResourceManager.readStream('file:/ui/index.html');
  }

  @Get(/[.]js$/)
  @Produces('application/javascript')
  getJs(req: Request) {
    return ResourceManager.readStream(`file:${req.url}`);
  }

  @Get(/[.]css$/)
  @Produces('text/css')
  getCss(req: Request) {
    return ResourceManager.readStream(`file:${req.url}`);
  }
}