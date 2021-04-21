import { Controller, Get, Header, Response, SetHeaders } from '@travetto/rest';
import { ResourceManager } from '@travetto/base';

@Controller('/')
export class UIController {

  @Get('/')
  @SetHeaders({ 'content-type': 'text/html' })
  getHomepage() {
    return ResourceManager.readStream('/index.html');
  }
}