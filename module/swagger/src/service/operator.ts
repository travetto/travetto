import { ExpressOperator, ExpressApp } from '@travetto/express';
import { Inject } from '@travetto/di';
import { SwaggerService } from '@travetto/swagger/src/service/swagger';

export class SwaggerOperator extends ExpressOperator {
  @Inject()
  service: SwaggerService;

  operate(app: ExpressApp): void {
    app.get().all('/swagger.json', (req, res) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      if (req.method === 'GET') {
        res.json(this.service.getSpec());
      } else {
        res.status(201).send();
      }
    });
  }
}