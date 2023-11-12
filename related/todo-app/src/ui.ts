import { Readable } from 'stream';

import { Controller, Get, Produces, Request, Undocumented } from '@travetto/rest';
import { ResourceLoader } from '@travetto/base';

@Controller('/ui')
@Undocumented()
export class UIController {

  resources = new ResourceLoader();

  @Get('/')
  @Produces('text/html')
  getHomepage(): Promise<Readable> {
    return this.resources.readStream('/ui/index.html');
  }

  @Get('js/*')
  @Produces('application/javascript')
  getJs(req: Request): Promise<Readable> {
    return this.resources.readStream(req.url);
  }

  @Get('css/*')
  @Produces('text/css')
  getCss(req: Request): Promise<Readable> {
    return this.resources.readStream(req.url);
  }
}