import { DependencyRegistry } from '@travetto/di';
import { Runtime } from '@travetto/runtime';
import { Controller, Get, WebConfig } from '@travetto/web';

@Controller('/', {
  documented: false,
  conditional: async () => {
    const config = await DependencyRegistry.getInstance(WebConfig);
    return !!config.defaultMessage;
  }
})
export class GlobalHandler {

  @Get()
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  handler() {
    return {
      module: Runtime.main.name,
      version: Runtime.main.version,
      env: Runtime.env
    };
  }
}