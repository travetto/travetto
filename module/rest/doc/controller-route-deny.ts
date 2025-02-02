import { Controller, Get, QueryParam, ConfigureInterceptor, CorsInterceptor } from '@travetto/rest';

@Controller('/allowDeny')
@ConfigureInterceptor(CorsInterceptor, { disabled: true })
export class AlowDenyController {

  @Get('/override')
  @ConfigureInterceptor(CorsInterceptor, { disabled: false })
  cookies(@QueryParam() value: string) {

  }
}