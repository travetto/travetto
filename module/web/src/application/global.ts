import { DependencyRegistry } from '@travetto/di';
import { Runtime } from '@travetto/runtime';
import { ConditionalRegister, ConfigureInterceptor, Controller, Get, LoggingInterceptor, Options, Undocumented, WebConfig } from '@travetto/web';

@Undocumented()
@Controller('/')
@ConfigureInterceptor(LoggingInterceptor, { disabled: true })
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