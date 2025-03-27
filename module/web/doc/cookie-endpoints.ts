import { GetOption, SetOption } from 'cookies';

import { Controller, Get, QueryParam, HttpRequest, ContextParam, HttpPayload } from '@travetto/web';

@Controller('/simple')
export class SimpleEndpoints {

  private getOptions: GetOption;
  private setOptions: SetOption;

  @ContextParam()
  req: HttpRequest;

  @Get('/cookies')
  cookies(@QueryParam() value: string) {
    this.req.getCookie('name', this.getOptions);

    // Set a cookie on response
    const result = HttpPayload.fromEmpty();
    result.setCookie('name', value, this.setOptions);
    return result;
  }
}