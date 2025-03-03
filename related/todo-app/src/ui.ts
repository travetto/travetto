import { Readable } from 'node:stream';

import { Controller, Get, Produces, HttpRequest, Undocumented } from '@travetto/web';
import { RuntimeResources } from '@travetto/runtime';
import { AsyncContextField } from '@travetto/context';

@Controller('/ui')
@Undocumented()
export class UIController {

  @AsyncContextField()
  readonly req: HttpRequest;

  @Get('/')
  @Produces('text/html')
  getHomepage(): Promise<Readable> {
    return RuntimeResources.readStream('/ui/index.html');
  }

  @Get('js/*')
  @Produces('application/javascript')
  getJs(): Promise<Readable> {
    return RuntimeResources.readStream(this.req.url);
  }

  @Get('css/*')
  @Produces('text/css')
  getCss(): Promise<Readable> {
    return RuntimeResources.readStream(this.req.url);
  }
}