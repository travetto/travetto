import { Readable } from 'stream';

import { Controller, Get, Produces, Request, Undocumented } from '@travetto/rest';
import { FileResourceProvider } from '@travetto/base';

@Controller('/ui')
@Undocumented()
export class UIController {

  resources = new FileResourceProvider({ includeCommon: true });

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