import { requestContext } from '@encore/context/ext/express';
import { AppService } from './service';
import { RouteRegistry } from './service';

AppService.init();
AppService.use(requestContext);
AppService.errorHandler(RouteRegistry.errorHandler);
