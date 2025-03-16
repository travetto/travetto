import { ConfigureInterceptor, Controller, LoggingInterceptor, Options } from '@travetto/web';

@Controller('/', {
  documented: false,
})
export class GlobalOptionsHandler {

  @ConfigureInterceptor(LoggingInterceptor, { disabled: true })
  @Options('*all')
  handler(): string {
    return '';
  }
}