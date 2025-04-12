import { Controller, Get, QueryParam, WebRequest, ContextParam, WebResponse } from '@travetto/web';
import { CookieGetOptions, CookieSetOptions } from '../src/types/cookie.ts';

@Controller('/simple')
export class SimpleEndpoints {

  private getOptions: CookieGetOptions;
  private setOptions: CookieSetOptions;

  @ContextParam()
  req: WebRequest;

  @Get('/cookies')
  cookies(@QueryParam() value: string) {
    this.req.getCookie('name', this.getOptions);

    // Set a cookie on response
    const result = WebResponse.from(null);
    result.cookies.push({ name: 'name', value, ...this.setOptions });
    return result;
  }
}