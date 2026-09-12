import assert from 'node:assert';

import type { ModelCrudSupport, ModelType } from '@travetto/model';
import { Suite, Test } from '@travetto/test';

import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import type { DateFieldAggregateResult, ModelQueryAggregateSupport, NumberFieldAggregateResult } from '../../src/types/aggregate.ts';
import { Aged, BigIntModel, MultiFieldModel, Person } from './model.ts';

@Suite()
export abstract class ModelQueryAggregateSuite extends BaseModelSuite<ModelQueryAggregateSupport & ModelCrudSupport> {
  @Test('verify date field aggregate')
  async testDateFieldAggregate() {
    const service = await this.service;

    const firstDate = new Date(2020, 0, 1);
    const secondDate = new Date(2021, 0, 1);
    const thirdDate = new Date(2022, 0, 1);

    await this.saveAll(Aged, [
      Aged.from({ createdAt: firstDate }),
      Aged.from({ createdAt: secondDate }),
      Aged.from({ createdAt: thirdDate })
    ]);

    const aggregate = await service.aggregateFieldByQuery(Aged, 'createdAt');
    assert(aggregate.count === 3);
    assert(aggregate.min instanceof Date);
    assert(aggregate.min.getTime() === firstDate.getTime());
    assert(aggregate.max instanceof Date);
    assert(aggregate.max.getTime() === thirdDate.getTime());
  }

  @Test('verify model with multiple field types aggregate')
  async testMultiFieldModelAggregate() {
    const service = await this.service;
    const now = new Date();
    await this.saveAll(MultiFieldModel, [
      MultiFieldModel.from({ createdAt: now, score: 10 }),
      MultiFieldModel.from({ createdAt: now, score: 20 })
    ]);

    const dateStats = await service.aggregateFieldByQuery(MultiFieldModel, 'createdAt');
    const dateCheck: DateFieldAggregateResult = dateStats;
    assert(dateCheck.count === 2);
    assert(dateCheck.min instanceof Date);

    const numberStats = await service.aggregateFieldByQuery(MultiFieldModel, 'score');
    const numberCheck: NumberFieldAggregateResult = numberStats;
    assert(numberCheck.count === 2);
    assert(numberCheck.min === 10);
    assert(numberCheck.avg === 15);
  }

  @Test('verify field aggregate')
  async testFieldAggregate() {
    const people = [
      Person.from({ name: 'Bob', age: 20, gender: 'm', address: { street1: '1st St' } }),
      Person.from({ name: 'Alice', age: 30, gender: 'f', address: { street1: '2nd St' } }),
      Person.from({ name: 'Charlie', age: 40, gender: 'm', address: { street1: '3rd St' } }),
      Person.from({ name: 'Dana', age: 50, gender: 'f', address: { street1: '4th St' } })
    ];

    const service = await this.service;
    const saved = await this.saveAll(Person, people);
    assert(saved === 4);

    const aggregate = await service.aggregateFieldByQuery(Person, 'age');
    assert(aggregate.count === 4);
    assert(aggregate.min === 20);
    assert(aggregate.max === 50);
    assert(aggregate.avg === 35);
    assert(aggregate.sum === 140);

    const filteredAggregate = await service.aggregateFieldByQuery(Person, 'age', {
      where: {
        age: { $gte: 30 }
      }
    });
    assert(filteredAggregate.count === 3);
    assert(filteredAggregate.min === 30);
    assert(filteredAggregate.max === 50);
    assert(filteredAggregate.avg === 40);
    assert(filteredAggregate.sum === 120);

    const emptyAggregate = await service.aggregateFieldByQuery(Person, 'age', {
      where: {
        age: { $gt: 1000 }
      }
    });
    assert(emptyAggregate.count === 0);
    assert(emptyAggregate.min === undefined);
    assert(emptyAggregate.max === undefined);
    assert(emptyAggregate.avg === undefined);
    assert(emptyAggregate.sum === undefined);
  }

  @Test('verify bigint field aggregate')
  async testBigIntFieldAggregate() {
    const service = await this.service;

    await this.saveAll(BigIntModel, [
      BigIntModel.from({ largeNumber: 100n }),
      BigIntModel.from({ largeNumber: 200n }),
      BigIntModel.from({ largeNumber: 300n })
    ]);

    const aggregate = await service.aggregateFieldByQuery(BigIntModel, 'largeNumber');
    assert(aggregate.count === 3);
    assert(aggregate.min === 100n);
    assert(aggregate.max === 300n);
    assert(aggregate.avg === 200n);
    assert(aggregate.sum === 600n);
  }
}
