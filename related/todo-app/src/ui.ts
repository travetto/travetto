import { Controller, Get, Produces, Request } from '@travetto/rest';
import { CommonFileResourceProvider } from '@travetto/base';

@Controller('/ui')
export class UIController {

  resources = new CommonFileResourceProvider();

  @Get('/')
  @Produces('text/html')
  getHomepage(): ReadableStream {
    return this.resources.readStream('/ui/index.html');
  }

  @Get(/[.]js$/)
  @Produces('application/javascript')
  getJs(req: Request): ReadableStream {
    return this.resources.readStream(req.url);
  }

  @Get(/[.]css$/)
  @Produces('text/css')
  getCss(req: Request): ReadableStream {
    return this.resources.readStream(req.url);
  }
}