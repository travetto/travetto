import { DependencyRegistry } from '@travetto/di';
import { Runtime } from '@travetto/runtime';

import { Controller } from '../decorator/controller.ts';
import { ConditionalRegister, ConfigureInterceptor, Undocumented } from '../decorator/common.ts';
import { Get, Options } from '../decorator/endpoint.ts';
import { WebConfig } from './config.ts';
import { LoggingInterceptor, } from '../interceptor/logging.ts';

@Undocumented()
@Controller('/')
@ConfigureInterceptor(LoggingInterceptor, { applies: false })
export class GlobalHandler {

  @Get('')
  @ConditionalRegister(async () => {
    const config = await DependencyRegistry.getInstance(WebConfig);
    return config.defaultMessage;
  })
  message(): { module: string, version: string, env?: string } {
    return {
      module: Runtime.main.name,
      version: Runtime.main.version,
      env: Runtime.env
    };
  }

  @ConditionalRegister(async () => {
    const config = await DependencyRegistry.getInstance(WebConfig);
    return config.optionsGlobalHandle;
  })
  @Options('*all')
  options(): string {
    return '';
  }
}