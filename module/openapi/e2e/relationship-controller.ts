import { SchemaQuery, Body, Controller, Get, Post, Put, Delete, Path } from '@travetto/rest';

import { User, UserSearch } from './model';

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
  async getByName(@Path() name: string): Promise<User> {
    return new User();
  }

  /**
   * Get all users.
   * @returns A list of users
   */
  @Get('/')
  async getAll(@SchemaQuery() search: UserSearch): Promise<User[]> {
    return [];
  }

  @Post('/')
  async createUser(@Body() user: User): Promise<User> {
    return new User();
  }

  /**
   * Update user by id
   * @param id User id
   */
  @Put('/:id')
  async updateUser(@Path() id: number, @Body() user: User): Promise<void> {

  }
  /**
   * Delete user by id
   * @param id User id
   */
  @Delete('/:id')
  async removeUser(@Path() id: number): Promise<void> {

  }
}