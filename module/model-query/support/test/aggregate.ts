import assert from 'node:assert';

import type { ModelCrudSupport } from '@travetto/model';
import { Suite, Test } from '@travetto/test';

import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import type { ModelQueryAggregateSupport } from '../../src/types/aggregate.ts';
import { Aged, BigIntModel, Person } from './model.ts';

@Suite()
export abstract class ModelQueryAggregateSuite extends BaseModelSuite<ModelQueryAggregateSupport & ModelCrudSupport> {
  @Test('verify basic aggregations')
  async testAggregate() {
    const people = [
      Person.from({ name: 'Bob', age: 20, gender: 'm', address: { street1: '1st St' } }),
      Person.from({ name: 'Alice', age: 30, gender: 'f', address: { street1: '2nd St' } }),
      Person.from({ name: 'Charlie', age: 40, gender: 'm', address: { street1: '3rd St' } }),
      Person.from({ name: 'Dana', age: 50, gender: 'f', address: { street1: '4th St' } })
    ];

    const service = await this.service;
    const saved = await this.saveAll(Person, people);
    assert(saved === 4);

    const sumResult = await service.aggregateFieldByQuery(Person, 'sum', 'age');
    assert(sumResult === 140);

    const averageResult = await service.aggregateFieldByQuery(Person, 'avg', 'age');
    assert(averageResult === 35);

    const minimumResult = await service.aggregateFieldByQuery(Person, 'min', 'age');
    assert(minimumResult === 20);

    const maximumResult = await service.aggregateFieldByQuery(Person, 'max', 'age');
    assert(maximumResult === 50);

    // Filtered aggregations
    const filteredSumResult = await service.aggregateFieldByQuery(Person, 'sum', 'age', {
      where: {
        age: { $gte: 30 }
      }
    });
    assert(filteredSumResult === 120);

    const filteredAverageResult = await service.aggregateFieldByQuery(Person, 'avg', 'age', {
      where: {
        gender: 'f'
      }
    });
    assert(filteredAverageResult === 40);

    // No matches
    const noMatchResult = await service.aggregateFieldByQuery(Person, 'sum', 'age', {
      where: {
        age: { $gt: 1000 }
      }
    });
    assert(noMatchResult === undefined);
  }

  @Test('verify date aggregations')
  async testDateAggregate() {
    const service = await this.service;

    const firstDate = new Date(2020, 0, 1);
    const secondDate = new Date(2021, 0, 1);
    const thirdDate = new Date(2022, 0, 1);

    await this.saveAll(Aged, [
      Aged.from({ createdAt: firstDate }),
      Aged.from({ createdAt: secondDate }),
      Aged.from({ createdAt: thirdDate })
    ]);

    const minimumDateResult = await service.aggregateFieldByQuery(Aged, 'min', 'createdAt');
    assert(minimumDateResult instanceof Date);
    assert(minimumDateResult.getTime() === firstDate.getTime());

    const maximumDateResult = await service.aggregateFieldByQuery(Aged, 'max', 'createdAt');
    assert(maximumDateResult instanceof Date);
    assert(maximumDateResult.getTime() === thirdDate.getTime());
  }

  @Test('verify bigint aggregations')
  async testBigIntAggregate() {
    const service = await this.service;

    await this.saveAll(BigIntModel, [
      BigIntModel.from({ largeNumber: 100n }),
      BigIntModel.from({ largeNumber: 200n }),
      BigIntModel.from({ largeNumber: 300n })
    ]);

    const sumResult = await service.aggregateFieldByQuery(BigIntModel, 'sum', 'largeNumber');
    assert(sumResult === 600n);

    const minimumResult = await service.aggregateFieldByQuery(BigIntModel, 'min', 'largeNumber');
    assert(minimumResult === 100n);

    const maximumResult = await service.aggregateFieldByQuery(BigIntModel, 'max', 'largeNumber');
    assert(maximumResult === 300n);

    const averageResult = await service.aggregateFieldByQuery(BigIntModel, 'avg', 'largeNumber');
    assert(averageResult === 200n);
  }
}
