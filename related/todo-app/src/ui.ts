import { Readable } from 'node:stream';

import { Controller, Get, Produces, WebRequest, Undocumented, ContextParam } from '@travetto/web';
import { RuntimeResources } from '@travetto/runtime';

@Controller('/ui')
@Undocumented()
export class UIController {

  @ContextParam()
  request: WebRequest;

  @Get('/')
  @Produces('text/html')
  getHomepage(): Promise<Readable> {
    return RuntimeResources.readStream('/ui/index.html');
  }

  @Get('js/*')
  @Produces('application/javascript')
  getJs(): Promise<Readable> {
    return RuntimeResources.readStream(this.request.context.path);
  }

  @Get('css/*')
  @Produces('text/css')
  getCss(): Promise<Readable> {
    return RuntimeResources.readStream(this.request.context.path);
  }
}