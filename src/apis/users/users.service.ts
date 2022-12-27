import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import {
  IUsersServiceCreate,
  IUsersServiceFindOne,
} from './interfaces/users-service.interface';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // 유저 생성
  async create({
    email,
    hashedPassword: password,
    name,
    address,
    phoneNumber,
    veganLevel,
  }: IUsersServiceCreate): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (user) throw new ConflictException('이미 등록된 이메일 입니다.');
    return this.usersRepository.save({
      email,
      password,
      name,
      address,
      phoneNumber,
      veganLevel,
    });
  }

  // 이메일로 유저 조회
  findOne({ email }: IUsersServiceFindOne): Promise<User> {
    return this.usersRepository.findOne({
      where: { email },
      withDeleted: true,
    });
  }

  // 유저정보 삭제
  async delete({ email }) {
    const result = await this.usersRepository.softDelete({ email });
    return result.affected ? true : false;
  }

  // 유저정보 복구
  async restore({ email }) {
    const result = await this.usersRepository.restore({
      email,
    });
    return result.affected ? true : false;
  }
}