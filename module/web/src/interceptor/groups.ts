import { Injectable } from '@travetto/di';
import { HttpInterceptor, HttpInterceptorGroup } from './types';

@Injectable()
class RequestGroupStart implements HttpInterceptor {
  placeholder = true;
  intercept(): void { }
}

@Injectable()
class RequestGroupEnd implements HttpInterceptor {
  dependsOn = [ResponseGroupStart];
  placeholder = true;
  intercept(): void { }
}

@Injectable()
class ResponseGroupStart implements HttpInterceptor {
  dependsOn = [RequestGroupEnd];
  placeholder = true;
  intercept(): void { }
}

@Injectable()
class ResponseGroupEnd implements HttpInterceptor {
  dependsOn = [ResponseGroupStart];
  placeholder = true;
  intercept(): void { }
}

@Injectable()
class ApplicationGroupStart implements HttpInterceptor {
  dependsOn = [ResponseGroupEnd];
  placeholder = true;
  intercept(): void { }
}

@Injectable()
class ApplicationGroupEnd implements HttpInterceptor {
  dependsOn = [ApplicationGroupStart];
  placeholder = true;
  intercept(): void { }
}

export const RequestInterceptorGroup: HttpInterceptorGroup = {
  group: [RequestGroupStart, RequestGroupEnd]
};

export const ResponseInterceptorGroup: HttpInterceptorGroup = {
  group: [ResponseGroupStart, ResponseGroupEnd]
};

export const ApplicationInterceptorGroup: HttpInterceptorGroup = {
  group: [ApplicationGroupStart, ApplicationGroupEnd]
};