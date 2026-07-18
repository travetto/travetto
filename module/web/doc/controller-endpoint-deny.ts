import { ConfigureInterceptor, Controller, CorsInterceptor, ExcludeInterceptors, Get, QueryParam } from '@travetto/web';

@Controller('/allowDeny')
@ConfigureInterceptor(CorsInterceptor, { applies: true })
export class AlowDenyController {
  @Get('/override')
  @ConfigureInterceptor(CorsInterceptor, { applies: false })
  withoutCors(@QueryParam() value: string) {}

  @Get('/raw')
  @ExcludeInterceptors(({ category }) => category === 'response')
  withoutResponse(@QueryParam() value: string) {}
}
