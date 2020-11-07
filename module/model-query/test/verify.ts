import * as assert from 'assert';

import { Class, RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { ValidationResultError, Schema } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';

import { Model, ModelQuery, ModelCore, BaseModel, QueryVerifierService, Query } from '..';
import { QueryLanguageParser } from '../src/internal/query-lang/parser';

@Schema()
class Preferences {
  size: number;
  language?: string;
}

@Model()
class User {
  id: number;
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
    const verifier = await DependencyRegistry.getInstance(QueryVerifierService);

    const test = <T>(cls: Class<T>) => {
      const t: Query<ModelCore> = {
        where: {
          id: {
            $eq: '5'
          }
        }
      };
      verifier.verify(cls, t as Query<T>);
    };

    assert.doesNotThrow(() => test(ModelUser));
    assert.throws(() => test(User), ValidationResultError);
  }

  @Test()
  async verifyNested() {
    const verifier = await DependencyRegistry.getInstance(QueryVerifierService);

    const query: ModelQuery<User> = {
      where: {
        id: 5,
        prefs: {
          language: {
            $eq: 'a'
          }
        }
      }
    };

    verifier.verify(User, query);
  }

  @Test()
  async verifyQueryString() {
    const verifier = await DependencyRegistry.getInstance(QueryVerifierService);

    const test = <T>(cls: Class<T>) => {
      const t: Query<ModelCore> = {
        where: QueryLanguageParser.parseToQuery('id == "5"')
      };
      verifier.verify(cls, t as Query<T>);
    };

    assert.doesNotThrow(() => test(ModelUser));
    assert.throws(() => test(User), ValidationResultError);

    const test2 = <T>(cls: Class<T>) => {
      const t: Query<ModelCore> = {
        where: QueryLanguageParser.parseToQuery('email ~ /bob.*/')
      };
      verifier.verify(cls, t as Query<T>);
    };

    assert.doesNotThrow(() => test2(ModelUser));
    assert.doesNotThrow(() => test2(User));
  }

  @Test()
  async verifyQueryRegex() {
    const verifier = await DependencyRegistry.getInstance(QueryVerifierService);

    assert.doesNotThrow(() => {
      verifier.verify(User, {
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
    const verifier = await DependencyRegistry.getInstance(QueryVerifierService);

    for (const op of ['$in', '$nin', '$all', '$elemMatch']) {

      assert.throws(() => {
        verifier.verify(User, {
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
