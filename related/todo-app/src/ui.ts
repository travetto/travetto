import { Controller, Get, Request, SetHeaders } from '@travetto/rest';
import { ResourceManager } from '@travetto/base';

@Controller('/ui')
export class UIController {

  @Get('/')
  @SetHeaders({ 'content-type': 'text/html' })
  getHomepage() {
    return ResourceManager.readStream('/ui/index.html');
  }

  @Get(/[.]js$/)
  @SetHeaders({ 'content-type': 'application/javascript' })
  getJs(req: Request) {
    return ResourceManager.readStream(req.url);
  }

  @Get(/[.]css$/)
  @SetHeaders({ 'content-type': 'text/css' })
  getCss(req: Request) {
    return ResourceManager.readStream(req.url);
  }
}