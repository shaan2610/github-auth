import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './users.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private UserRepository: Repository<User>,
  ) {}

  async createUser(username: string, accessToken: string): Promise<void> {
    const user = new User();
    user.username = username;
    user.accessToken = accessToken;
    await this.UserRepository.save(user);
  }

  async getAccessToken(username: string): Promise<string> {
    const user = await this.UserRepository.findOne({
      where: { username: username },
    });
    return user.accessToken;
  }
}