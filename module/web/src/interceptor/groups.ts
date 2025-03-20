import { HttpInterceptorGroup } from './types';

class Basic {
  placeholder = true;
  intercept(): void { }
}

class RequestGroupStart extends Basic { }
class RequestGroupEnd extends Basic { dependsOn = [ResponseGroupStart]; }
class ResponseGroupStart extends Basic { dependsOn = [RequestGroupEnd]; }
class ResponseGroupEnd extends Basic { dependsOn = [ResponseGroupStart]; }
class ApplicationGroupStart extends Basic { dependsOn = [ResponseGroupEnd]; }
class ApplicationGroupEnd extends Basic { dependsOn = [ApplicationGroupStart]; }

export const InterceptorGroup = {
  Request: new HttpInterceptorGroup(RequestGroupStart, RequestGroupEnd),
  Response: new HttpInterceptorGroup(ResponseGroupStart, ResponseGroupEnd),
  Application: new HttpInterceptorGroup(ApplicationGroupStart, ApplicationGroupEnd),
};