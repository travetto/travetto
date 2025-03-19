import { Injectable } from '@travetto/di';
import { HttpInterceptor } from './types';

@Injectable()
export class RequestLayerGroup implements HttpInterceptor {
  placeholder = true;
  intercept(): void { }
}

@Injectable()
export class ResponseLayerGroup implements HttpInterceptor {
  dependsOn = [RequestLayerGroup];
  placeholder = true;
  intercept(): void { }
}

@Injectable()
export class ApplicationLayerGroup implements HttpInterceptor {
  dependsOn = [ResponseLayerGroup];
  placeholder = true;
  intercept(): void { }
}