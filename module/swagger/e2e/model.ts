import { Schema } from '@travetto/schema';

/**
 * User instance for framework
 */
@Schema()
export class User {
  id: string;
  /**
   * User's first and last name
   */
  name: string;

  /**
   * User's age in years
   */
  age: number;
  dob: Date;
  height: number;
  aliases: string[];
  weight: number;
}

@Schema()
export class Paging {
  start?: number;
  size?: number;
}

@Schema()
export class UserSearch {
  age?: number;
  /**
   * DOB is fixed
   */
  deceased?: boolean;

  page: Paging;
}
