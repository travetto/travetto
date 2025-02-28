import { Readable } from 'node:stream';

import { Controller, Get, Produces, HttpRequest, Undocumented } from '@travetto/rest';
import { RuntimeResources } from '@travetto/runtime';

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
  getJs(req: HttpRequest): Promise<Readable> {
    return RuntimeResources.readStream(req.url);
  }

  @Get('css/*')
  @Produces('text/css')
  getCss(req: HttpRequest): Promise<Readable> {
    return RuntimeResources.readStream(req.url);
  }
}