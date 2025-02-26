import { Controller, Get, Post, Put, Delete } from '@travetto/rest';

import { User, UserSearch } from './model.ts';

/**
 * Relationships for the win
 */
@Controller('/relationship')
export class RelationshipController {

  /**
   * Get user by name.
   * @param name User name
   * @returns A user by name
   */
  @Get('/:name')
  async getByName(name: string): Promise<User> {
    return new User();
  }

  /**
   * Get all users.
   * @returns A list of users
   */
  @Get('/')
  async getAll(search: UserSearch): Promise<User[]> {
    return [];
  }

  @Post('/')
  async createUser(user: User): Promise<User> {
    return new User();
  }

  /**
   * Update user by id
   * @param id User id
   */
  @Put('/:id')
  async updateUser(id: number, user: User): Promise<void> {

  }
  /**
   * Delete user by id
   * @param id User id
   */
  @Delete('/:id')
  async removeUser(id: number): Promise<void> {

  }
}