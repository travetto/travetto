import { ConfigureInterceptor, Controller, LoggingInterceptor, Options } from '@travetto/web';

@Controller('/', { documented: false })
@ConfigureInterceptor(LoggingInterceptor, { disabled: true })
export class GlobalOptionsHandler {

  @Options('*all')
  handler(): string {
    return '';
  }
}