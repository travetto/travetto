import { DependencyRegistryIndex } from '@travetto/di';
import { Runtime } from '@travetto/runtime';
import { IsPrivate } from '@travetto/schema';

import { Controller } from '../decorator/controller.ts';
import { ConditionalRegister, ConfigureInterceptor } from '../decorator/common.ts';
import { Get, Options } from '../decorator/endpoint.ts';
import { WebConfig } from '../config.ts';
import { LoggingInterceptor, } from '../interceptor/logging.ts';

@IsPrivate()
@Controller('/')
@ConfigureInterceptor(LoggingInterceptor, { applies: false })
export class GlobalHandler {

  @Get('')
  @ConditionalRegister(async () => {
    const config = await DependencyRegistryIndex.getInstance(WebConfig);
    return config.defaultMessage;
  })
  message(): { module: string, version: string, env?: string } {
    return {
      module: Runtime.main.name,
      version: Runtime.main.version,
      env: Runtime.env
    };
  }

  @Options('*all')
  options(): void { }
}