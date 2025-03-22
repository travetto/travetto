import { Controller, Get, QueryParam, ConfigureInterceptor, CorsInterceptor, ExcludeInterceptors } from '@travetto/web';

@Controller('/allowDeny')
@ConfigureInterceptor(CorsInterceptor, { disabled: true })
export class AlowDenyController {

  @Get('/override')
  @ConfigureInterceptor(CorsInterceptor, { disabled: false })
  withoutCors(@QueryParam() value: string) {

  }

  @Get('/raw')
  @ExcludeInterceptors(v => v.category === 'response')
  withoutResponse(@QueryParam() value: string) {

  }
}