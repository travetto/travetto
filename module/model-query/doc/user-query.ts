import { ModelQuerySupport } from '@travetto/model-query';
import { User } from './user';

export class UserSearch {
  service: ModelQuerySupport;

  find() {
    return this.service.query(User, {
      where: {
        $and: [
          {
            $not: {
              age: {
                $lt: 35
              }
            }
          },
          {
            contact: {
              $exists: true
            }
          }
        ]
      }
    });
  }
}