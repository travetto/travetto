import assert from 'node:assert';

import type { ModelCrudSupport } from '@travetto/model';
import { castTo } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import type { ModelQuerySupport } from '../../src/types/query.ts';
import { Article } from './model.ts';

@Suite()
export abstract class ModelQueryTextSuite extends BaseModelSuite<ModelQuerySupport & ModelCrudSupport> {
  supportsStemming = true;

  async #loadArticles() {
    await this.saveAll(Article, [
      Article.from({
        title: 'PostgreSQL Relational Database Guide',
        content: 'Comprehensive overview of SQL schemas, relational tables, and query optimization.',
        status: 'published'
      }),
      Article.from({
        title: 'Modern Document Storage',
        content: 'Exploring JSON documents and how PostgreSQL supports advanced full-text search.',
        status: 'published'
      }),
      Article.from({
        title: 'Elasticsearch Search Engine Architecture',
        content: 'Deep dive into Apache Lucene inverted index and distributed search clusters.',
        status: 'draft'
      }),
      Article.from({
        title: 'Database Benchmarking',
        content: 'Performance analysis comparing relational databases and document search engines.',
        status: 'published'
      })
    ]);
  }

  @Test('Verify field-level text search')
  async testFieldTextSearch() {
    const service = await this.service;
    await this.#loadArticles();

    const results = await service.query(Article, {
      where: { title: { $text: 'PostgreSQL' } },
      sort: [{ $score: -1 }]
    });
    assert(results.length === 1);
    assert(results[0].title === 'PostgreSQL Relational Database Guide');
  }

  @Test('Verify multi-field text search')
  async testMultiFieldSearch() {
    const service = await this.service;
    await this.#loadArticles();

    const results = await service.query(Article, {
      where: {
        $or: [{ title: { $text: 'PostgreSQL' } }, { content: { $text: 'PostgreSQL' } }]
      },
      sort: [{ $score: -1 }]
    });
    assert(results.length === 2);
    const titles = new Set(results.map(article => article.title));
    assert(titles.has('PostgreSQL Relational Database Guide'));
    assert(titles.has('Modern Document Storage'));
  }

  @Test('Verify quoted phrase search')
  async testPhraseSearch() {
    const service = await this.service;
    await this.#loadArticles();

    const results = await service.query(Article, {
      where: { content: { $text: '"inverted index"' } },
      sort: [{ $score: -1 }]
    });
    assert(results.length === 1);
    assert(results[0].title === 'Elasticsearch Search Engine Architecture');
  }

  @Test('Verify text search with exclusion')
  async testExclusionSearch() {
    const service = await this.service;
    await this.#loadArticles();

    const results = await service.query(Article, {
      where: { title: { $text: 'database -PostgreSQL' } },
      sort: [{ $score: -1 }]
    });
    assert(results.length === 1);
    assert(results[0].title === 'Database Benchmarking');
  }

  @Test('Verify text search with additional where filter')
  async testFilteredSearch() {
    const service = await this.service;
    await this.#loadArticles();

    const allLucene = await service.query(Article, {
      where: { content: { $text: 'Lucene' } }
    });
    assert(allLucene.length === 1);

    const publishedLucene = await service.query(Article, {
      where: { content: { $text: 'Lucene' }, status: 'published' }
    });
    assert(publishedLucene.length === 0);
  }

  @Test('Verify count by text')
  async testCountByText() {
    const service = await this.service;
    await this.#loadArticles();

    const count = await service.countByQuery(Article, {
      where: { title: { $text: 'PostgreSQL' } }
    });
    assert(count === 1);

    const filteredCount = await service.countByQuery(Article, {
      where: { title: { $text: 'PostgreSQL' }, status: 'draft' }
    });
    assert(filteredCount === 0);
  }

  @Test('Verify phrase negation')
  async testPhraseNegation() {
    const service = await this.service;
    await this.#loadArticles();

    const results = await service.query(Article, {
      where: { title: { $text: 'database -"Relational Database"' } }
    });
    assert(results.length === 1);
    assert(results[0].title === 'Database Benchmarking');
  }

  @Test('Verify multiple search terms')
  async testMultipleSearchTerms() {
    const service = await this.service;
    await this.#loadArticles();

    const results = await service.query(Article, {
      where: { title: { $text: 'PostgreSQL Guide' } }
    });
    assert(results.length === 1);
    assert(results[0].title === 'PostgreSQL Relational Database Guide');
  }

  @Test('Verify multiple text clauses with $and')
  async testMultipleTextClauses() {
    const service = await this.service;
    await this.#loadArticles();

    const results = await service.query(Article, {
      where: {
        $and: [{ title: { $text: 'PostgreSQL' } }, { content: { $text: 'optimization' } }]
      }
    });
    assert(results.length === 1);
    assert(results[0].title === 'PostgreSQL Relational Database Guide');

    const noResults = await service.query(Article, {
      where: {
        $and: [{ title: { $text: 'PostgreSQL' } }, { content: { $text: 'Lucene' } }]
      }
    });
    assert(noResults.length === 0);
  }

  @Test('Verify word stemming', { skip: (instance: unknown) => !castTo<ModelQueryTextSuite>(instance).supportsStemming })
  async testStemming() {
    const service = await this.service;
    await this.#loadArticles();

    const pluralResults = await service.query(Article, {
      where: { title: { $text: 'databases' } }
    });
    assert(pluralResults.length === 2);

    const stemmedResults = await service.query(Article, {
      where: { content: { $text: 'optimize' } }
    });
    assert(stemmedResults.length === 1);
    assert(stemmedResults[0].title === 'PostgreSQL Relational Database Guide');
  }
}
