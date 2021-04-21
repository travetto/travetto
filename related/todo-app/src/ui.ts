import { Controller, Get, Header, Response } from '@travetto/rest';
import { ResourceManager } from '@travetto/base';

@Controller('/')
export class UIController {

  @Get('/')
  getHomepage(res: Response) {
    res.setHeader('Content-Type', 'text/html');
    return ResourceManager.readStream('/index.html');
  }
}