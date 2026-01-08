import {
  Controller, Get, QueryParam, type WebRequest, ContextParam,
  WebResponse, type CookieJar, type CookieGetOptions, type CookieSetOptions
} from '@travetto/web';

@Controller('/simple')
export class SimpleEndpoints {

  private getOptions: CookieGetOptions;
  private setOptions: CookieSetOptions;

  @ContextParam()
  request: WebRequest;

  @ContextParam()
  cookies: CookieJar;

  @Get('/cookies')
  getCookies(@QueryParam() value: string) {
    this.cookies.get('name', this.getOptions);

    // Set a cookie on response
    this.cookies.set({ name: 'name', value, ...this.setOptions });
    return new WebResponse({ body: null });
  }
}