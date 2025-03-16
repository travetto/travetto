import { ConfigureInterceptor, Controller, LoggingInterceptor, Options } from '@travetto/web';

@Controller('/')
export class GlobalOptionsHandler {

  @ConfigureInterceptor(LoggingInterceptor, { disabled: true })
  @Options('*all')
  handler(): string {
    return '';
  }
}