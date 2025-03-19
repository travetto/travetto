import { HttpInterceptor, ApplicationLayerGroup, FilterContext } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class HelloWorldInterceptor implements HttpInterceptor {

  dependsOn = [ApplicationLayerGroup];

  intercept(ctx: FilterContext) {
    console.log('Hello world!');
  }
}