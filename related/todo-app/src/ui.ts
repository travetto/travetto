import { Controller, Get, Produces, type WebRequest, ContextParam } from '@travetto/web';
import { RuntimeResources, type BinaryStream } from '@travetto/runtime';
import { IsPrivate } from '@travetto/schema';

@Controller('/ui')
@IsPrivate()
export class UIController {

  @ContextParam()
  request: WebRequest;

  @Get('/')
  @Produces('text/html')
  getHomepage(): Promise<BinaryStream> {
    return RuntimeResources.readBinaryStream('/ui/index.html');
  }

  @Get('js/*')
  @Produces('application/javascript')
  getJs(): Promise<BinaryStream> {
    return RuntimeResources.readBinaryStream(this.request.context.path);
  }

  @Get('css/*')
  @Produces('text/css')
  getCss(): Promise<BinaryStream> {
    return RuntimeResources.readBinaryStream(this.request.context.path);
  }
}