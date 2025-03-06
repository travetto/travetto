import { HttpInterceptor, SerializeInterceptor, FilterContext } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements HttpInterceptor {

  dependsOn = [SerializeInterceptor];

  intercept(ctx: FilterContext) {
    console.log('Hello world!');
  }
}