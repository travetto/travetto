import * as express from 'express';

import { ExpressOperator } from '@travetto/express';
import { Inject, Injectable } from '@travetto/di';
import { SwaggerService } from '../service';
import { ClientGenerate } from '@travetto/swagger/src/service/client-generate';

@Injectable()
export class SwaggerOperator extends ExpressOperator {

  @Inject()
  service: SwaggerService;

  @Inject()
  generator: ClientGenerate;

  operate(app: express.Application): void {
    app.all('/swagger.json', (req, res) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      if (req.method === 'GET') {
        res.json(this.service.getSpec());
      } else {
        res.status(201).send();
      }
    });

    this.generator.run();
  }
}