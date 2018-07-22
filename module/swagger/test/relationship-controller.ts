import { Request, Response } from 'express';

import { Controller, Get, Post, Put, Delete } from '@travetto/express';
import { User } from '@travetto/swagger/test/model';

/**
 * Relationships for the win
 */
@Controller('/relationship')
export class RelationshipController {

  /**
   * Get user by name
   * @param name {string} User name
   * @returns A user by name
   */
  @Get('/:name')
  async getByName(req: Request, res: Response): Promise<User> {
    return undefined as any;
  }

  /**
   * Get all users
   * @returns A list of users
   */
  @Get('/')
  async getAll(req: Request, res: Response): Promise<User[]> {
    return undefined as any;
  }

  /**
   * @param req.body {User}
   */
  @Post('/')
  async createUser(req: Request, res: Response): Promise<User> {
    return undefined as any;
  }

  /**
   * Update user by id
   * @param id {number} User id
   * @param req.body {User} User to update
   */
  @Put('/:id')
  async updateUser(req: Request, res: Response): Promise<void> {

  }
  /**
   * Delete user by id
   * @param id {number} User id
   */
  @Delete('/:id')
  async removeUser(req: Request, res: Response): Promise<void> {

  }
}