import { DependencyRegistryIndex } from '@travetto/di';
import type { ManifestContext } from '@travetto/manifest';
import { Runtime } from '@travetto/runtime';
import { IsPrivate } from '@travetto/schema';

import { WebConfig } from '../config.ts';
import { ConditionalRegister, ConfigureInterceptor } from '../decorator/common.ts';
import { Controller } from '../decorator/controller.ts';
import { Get, Options } from '../decorator/endpoint.ts';
import { LoggingInterceptor } from '../interceptor/logging.ts';

@IsPrivate()
@Controller('/')
@ConfigureInterceptor(LoggingInterceptor, { applies: false })
export class GlobalHandler {
  @Get('')
  @ConditionalRegister(async () => {
    const config = await DependencyRegistryIndex.getInstance(WebConfig);
    return config.defaultMessage;
  })
  message(): ManifestContext['main'] {
    return Runtime.main;
  }

  @Options('*all')
  options(): void {}
}
