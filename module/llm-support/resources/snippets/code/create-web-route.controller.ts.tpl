import { Inject } from '@travetto/di';
import { Controller, Get } from '@travetto/web';

import { {{serviceName}} } from '../service/{{serviceFile}}.ts';

@Controller('/{{routePath}}')
export class {{controllerName}} {
  @Inject()
  service: {{serviceName}};

  @Get('/')
  list(): { items: string[] } {
    return { items: this.service.getItems() };
  }
}
