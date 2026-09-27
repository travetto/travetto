import assert from 'node:assert';

import { Model, type ModelType } from '@travetto/model';
import { type ModelQuery, type Query, QueryVerifier } from '@travetto/model-query';
import { QueryLanguageParser } from '@travetto/model-query-language';
import { Registry } from '@travetto/registry';
import { type Class, castTo } from '@travetto/runtime';
import { Schema } from '@travetto/schema';
import { BeforeAll, Suite, Test } from '@travetto/test';

@Schema()
class Preferences {
  size: number;
  language?: string;
}

@Model('users')
class User {
  id: string;
  email: string;
  preferences: Preferences;
}

@Model()
class ModelUser {
  id: string;
  email: string;
}

@Suite()
export class VerifyTest {
  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test()
  async verifyModelCore() {
    const test = <T extends ModelType>(cls: Class<T>) => {
      const t: Query<T> = {
        where: castTo({
          id: {
            $eq: '5'
          }
        })
      };
      QueryVerifier.verify(cls, t);
    };

    assert.doesNotThrow(() => test(ModelUser));
    assert.doesNotThrow(() => test(User));
  }

  @Test()
  async verifyNested() {
    const query: ModelQuery<User> = {
      where: {
        id: '5',
        preferences: {
          language: {
            $eq: 'a'
          }
        }
      }
    };

    QueryVerifier.verify(User, query);
  }

  @Test()
  async verifyQueryString() {
    const test = <T>(cls: Class<T>) => {
      const t: Query<T> = {
        where: QueryLanguageParser.parseToQuery('id == "5"')
      };
      QueryVerifier.verify(cls, t);
    };

    assert.doesNotThrow(() => test(ModelUser));
    assert.doesNotThrow(() => test(User));

    const test2 = <T extends ModelType>(cls: Class<T>) => {
      const t: Query<T> = {
        where: QueryLanguageParser.parseToQuery('email ~ /bob.*/')
      };
      QueryVerifier.verify(cls, t);
    };

    assert.doesNotThrow(() => test2(ModelUser));
    assert.doesNotThrow(() => test2(User));
  }

  @Test()
  async verifyQueryRegex() {
    assert.doesNotThrow(() => {
      QueryVerifier.verify(User, {
        where: {
          email: {
            $regex: '.*'
          }
        }
      });
    });
  }

  @Test()
  async verifyQueryText() {
    const test = <T extends ModelType>(cls: Class<T>) => {
      const query: Query<T> = {
        where: QueryLanguageParser.parseToQuery("email @@ 'bob'")
      };
      QueryVerifier.verify(cls, query);
    };

    assert.doesNotThrow(() => test(ModelUser));
    assert.doesNotThrow(() => test(User));
  }

  @Test()
  async verifyArrayOperationsWithEmpty() {
    for (const operator of ['$in', '$nin', '$all', '$elemMatch']) {
      await assert.rejects(
        async () =>
          QueryVerifier.verify(User, {
            where: {
              email: {
                [operator]: []
              }
            }
          }),
        /Validation Error/i
      );
    }
  }

  @Test()
  async verifyWhereSiblingProperties() {
    assert.doesNotThrow(() =>
      QueryVerifier.verify(User, {
        where: castTo({
          $and: [{ id: '5' }],
          email: 'test@example.com'
        })
      })
    );

    await assert.rejects(
      async () =>
        QueryVerifier.verify(User, {
          where: castTo({
            $and: [{ id: '5' }],
            unknownProperty: 'test'
          })
        }),
      /Validation Error/i
    );
  }

  @Test()
  async verifyNestedBooleanClauses() {
    assert.doesNotThrow(() =>
      QueryVerifier.verify(User, {
        where: castTo({
          preferences: {
            $or: [{ language: 'en' }, { language: 'es' }]
          }
        })
      })
    );

    await assert.rejects(
      async () =>
        QueryVerifier.verify(User, {
          where: castTo({
            preferences: {
              $or: [{ unknownLanguageField: 'en' }]
            }
          })
        }),
      /Validation Error/i
    );
  }

  @Test()
  async verifySortScore() {
    const errorList: string[] = [];
    const state = {
      path: 'sort',
      collect: (_path: string, message: string) => errorList.push(message),
      log: (message: string) => errorList.push(message),
      extend: (_subPath: string) => state
    };

    QueryVerifier.processSortClause(state, User, { $score: -1 });
    assert.deepStrictEqual(errorList, []);

    QueryVerifier.processSortClause(state, User, { $score: 1 });
    assert.deepStrictEqual(errorList, []);

    QueryVerifier.processSortClause(state, User, { email: 1 });
    assert.deepStrictEqual(errorList, []);

    QueryVerifier.processSortClause(state, User, { $score: 2 });
    assert.ok(errorList.length > 0);
  }
}
