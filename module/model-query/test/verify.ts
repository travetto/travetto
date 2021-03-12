import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { Class } from '@travetto/base';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Schema } from '@travetto/schema';
import { Model, ModelType, BaseModel } from '@travetto/model';

import { ModelQuery, Query } from '..';
import { QueryLanguageParser } from '../src/internal/query/parser';
import { QueryVerifier } from '../src/internal/query/verifier';

@Schema()
class Preferences {
  size: number;
  language?: string;
}

@Model()
class User {
  id: string;
  email: string;
  prefs: Preferences;
}

@Model()
class ModelUser extends BaseModel {
  email: string;
}

@Suite()
export class VerifyTest {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async verifyModelCore() {
    const test = <T>(cls: Class<T>) => {
      const t: Query<ModelType> = {
        where: {
          id: {
            $eq: '5'
          }
        }
      };
      QueryVerifier.verify(cls, t as Query<T>);
    };

    assert.doesNotThrow(() => test(ModelUser));
    assert.doesNotThrow(() => test(User));
  }

  @Test()
  async verifyNested() {
    const query: ModelQuery<User> = {
      where: {
        id: '5',
        prefs: {
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
      const t: Query<ModelType> = {
        where: QueryLanguageParser.parseToQuery('id == "5"')
      };
      QueryVerifier.verify(cls, t as Query<T>);
    };

    assert.doesNotThrow(() => test(ModelUser));
    assert.doesNotThrow(() => test(User));

    const test2 = <T>(cls: Class<T>) => {
      const t: Query<ModelType> = {
        where: QueryLanguageParser.parseToQuery('email ~ /bob.*/')
      };
      QueryVerifier.verify(cls, t as Query<T>);
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
  async verifyArrayOperationsWithEmpty() {
    for (const op of ['$in', '$nin', '$all', '$elemMatch']) {

      assert.throws(() => {
        QueryVerifier.verify(User, {
          where: {
            email: {
              [op]: []
            }
          }
        });
      }, /Validation Error/i);
    }
  }
}
