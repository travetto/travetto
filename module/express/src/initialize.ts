import { requestContext } from '@encore/context/ext/express';
import { AppService, RouteRegistry } from './service';

AppService.init()
  .use(requestContext)
  .errorHandler(RouteRegistry.errorHandler);
