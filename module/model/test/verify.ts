import { Suite, Test, BeforeAll } from '@travetto/test';
import { Model, ModelQuery } from '..';
import { Schema, SchemaRegistry } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';
import { QueryVerifierService } from '../src/service/query';
import { RetainFields } from '../src/model/query/common';

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

@Suite()
export class VerifyTest {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
    await SchemaRegistry.init();
  }

  @Test()
  async verifyNested() {
    const verifier = await DependencyRegistry.getInstance(QueryVerifierService);

    const t: RetainFields<User['prefs']> = null as any;

    const query: ModelQuery<User> = {
      where: {
        id: 5,
        prefs: {
          language: {
            $eq: 'en'
          }
        }
      }
    };

    verifier.verify(User, query)
  }

}