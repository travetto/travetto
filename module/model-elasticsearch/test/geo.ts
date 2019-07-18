import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { Point, Model, ModelService } from '@travetto/model';

import { BaseElasticsearchTest } from './base';

@Model()
class Location {
  id?: string;
  point: Point;
}

@Model()
class Region {
  id?: string;
  points: Point[];
}

@Suite()
export class GeoTestSuite extends BaseElasticsearchTest {
  @Test('Test within')
  async testWithin() {
    const svc = await DependencyRegistry.getInstance(ModelService);

    const toAdd = [];

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        toAdd.push(Location.from({
          point: [i, j],
        }));
      }
    }

    await svc.saveAll(Location, toAdd);

    const ret = await svc.getAllByQuery(Location, {
      limit: 100,
      where: {
        point: {
          $geoWithin: [[-1, -1], [-1, 6], [6, 6], [6, -1]]
        }
      }
    });

    assert(ret.length === 25);

    const rad = await svc.getAllByQuery(Location, {
      limit: 100,
      where: {
        point: {
          $near: [3, 3],
          $maxDistance: 100,
          $unit: 'km'
        }
      }
    });
    assert(rad.length < 25);
    assert(rad.length > 0);
  }
}