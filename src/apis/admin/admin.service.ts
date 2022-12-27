import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './entities/admin.entity';
import * as bcrypt from 'bcrypt';
import { IAdminServiceCreate } from './interfaces/admin-service.interface';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  async create({ createAdminInput }: IAdminServiceCreate): Promise<Admin> {
    const { password, ...rest } = createAdminInput;
    const hashedPassword = await bcrypt.hash(password, 10);
    return await this.adminRepository.save({
      ...rest,
      password: hashedPassword,
    });
  }
}