import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Model } from '@travetto/model';
import { LongText } from '@travetto/schema';
import { castTo } from '@travetto/runtime';
import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';

import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

@Model()
class TextModel {
  id: string;

  @LongText()
  document: string;
}

@Suite()
class MongoQuerySuite extends ModelQuerySuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;

  @Test()
  async validateTextSearch() {
    await this.saveAll(TextModel, [
      TextModel.from({ document: 'Roger dodger' }),
      TextModel.from({ document: 'Roger dodger2' }),
      TextModel.from({ document: 'Roger2 dodger' }),
      TextModel.from({ document: 'Roger2 dodger2' })
    ]);
    const svc: MongoModelService = castTo(await this.service);

    for (const item of ['roger', 'dodger', 'roger2', 'dodger2']) {
      const all = await svc.queryText(TextModel, item);
      assert(all.length === 2);
    }
    const one = await svc.queryText(TextModel, '"roger dodger" -dodger2');
    console.log(one);
    assert(one.length === 1);

    const all2 = await svc.queryText(TextModel, 'roger dodger');
    assert(all2.length === 3);

    const all3 = await svc.queryText(TextModel, 'roger dodger2 roger2 dodger');
    assert(all3.length === 4);

    const all4 = await svc.queryText(TextModel, 'roger2 roger');
    assert(all4.length === 4);
  }

  @Test()
  async validateStemming() {
    await this.saveAll(TextModel, [
      TextModel.from({ document: 'I was running from bear that was running as well' }),
      TextModel.from({ document: 'I ran at a bear, ferociously' }),
      TextModel.from({ document: 'We run from Bears fans on the weekend' }),
    ]);
    const svc: MongoModelService = castTo(await this.service);

    const all4 = await svc.queryText(TextModel, 'run');
    assert(all4.length === 2);
    assert(all4[0].document.includes('running as well'));

    const all5 = await svc.queryText(TextModel, 'ran');
    assert(all5.length === 1);

    const all6 = await svc.queryText(TextModel, 'bear');
    assert(all6.length === 3);

    const all7 = await svc.queryText(TextModel, 'bear run');
    assert(all7.length === 3);

    const all8 = await svc.queryText(TextModel, 'run from bear -ferocious');
    assert(all8.length === 2);

  }
}

@Suite()
class MongoQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
class MongoQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
class MongoQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
class MongoQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}