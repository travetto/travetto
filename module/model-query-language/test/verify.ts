import assert from 'node:assert';

import { RootRegistry } from '@travetto/registry';
import { castTo, Class } from '@travetto/runtime';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Schema } from '@travetto/schema';
import { Model, ModelType } from '@travetto/model';
import { QueryVerifier, Query, ModelQuery } from '@travetto/model-query';

import { QueryLanguageParser } from '../src/parser.ts';

@Schema()
class Preferences {
  size: number;
  language?: string;
}

@Model()
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
    await RootRegistry.init();
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
