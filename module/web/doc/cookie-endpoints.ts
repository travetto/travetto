import { Controller, Get, QueryParam, HttpRequest, ContextParam, HttpResponse } from '@travetto/web';
import { Cookie, CookieReadOptions } from '../src/types/cookie';

@Controller('/simple')
export class SimpleEndpoints {

  private getOptions: CookieReadOptions;
  private setOptions: Omit<Cookie, 'name' | 'value'>;

  @ContextParam()
  req: HttpRequest;

  @Get('/cookies')
  cookies(@QueryParam() value: string) {
    this.req.getCookie('name', this.getOptions);

    // Set a cookie on response
    const result = HttpResponse.fromEmpty();
    result.setCookie({ name: 'name', value, ...this.setOptions });
    return result;
  }
}