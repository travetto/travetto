import { Readable } from 'node:stream';

import { Controller, Get, Produces, Request, Undocumented } from '@travetto/rest';
import { RuntimeResources } from '@travetto/base';

@Controller('/ui')
@Undocumented()
export class UIController {

  @Get('/')
  @Produces('text/html')
  getHomepage(): Promise<Readable> {
    return RuntimeResources.readStream('/ui/index.html');
  }

  @Get('js/*')
  @Produces('application/javascript')
  getJs(req: Request): Promise<Readable> {
    return RuntimeResources.readStream(req.url);
  }

  @Get('css/*')
  @Produces('text/css')
  getCss(req: Request): Promise<Readable> {
    return RuntimeResources.readStream(req.url);
  }
}