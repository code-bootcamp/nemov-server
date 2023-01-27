import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import setEndToLocal from 'src/commons/utils/setEndToLocal';
import { DataSource, Repository } from 'typeorm';
import { IamportService } from '../iamport/iamport.service';
import { User } from '../users/entities/user.entity';
import { Point, POINT_TRANSACTION_STATUS_ENUM } from './entities/point.entity';
import {
  IPointsServiceCancelPointCharge,
  IPointsServiceCreatePointCharge,
  IPointsServiceFindAllByUser,
  IPointsServiceFindAllCountByUser,
  IPointsServiceValidateForPointCharge,
  IPointsServiceValidateForPointRefund,
  IPointsServiceValidateForPointRefundReturn,
} from './interfaces/points-service.interface';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(Point)
    private readonly pointsRepository: Repository<Point>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly iamportService: IamportService,
    private readonly dataSource: DataSource,
  ) {}

  async findAllByUser({
    startDate,
    endDate,
    page,
    id,
  }: IPointsServiceFindAllByUser): Promise<Point[]> {
    if ((startDate && !endDate) || (!startDate && endDate))
      throw new UnprocessableEntityException(
        '날짜 설정시 시작과 끝을 모두 지정해주세요.',
      );
    if (startDate && endDate) {
      const { endLocal } = setEndToLocal({ endDate });
      return await this.pointsRepository
        .createQueryBuilder('point')
        .leftJoinAndSelect('point.user', 'user')
        .where('point.user = :id', { id })
        .andWhere('point.createdAt BETWEEN :startDate AND :endLocal', {
          startDate,
          endLocal,
        })
        .orderBy('point.createdAt', 'DESC')
        .skip((page - 1) * 10)
        .take(10)
        .getMany();
    } else {
      return await this.pointsRepository
        .createQueryBuilder('point')
        .leftJoinAndSelect('point.user', 'user')
        .where('point.user = :id', { id })
        .orderBy('point.createdAt', 'DESC')
        .skip((page - 1) * 10)
        .take(10)
        .getMany();
    }
  }

  async findAllCountByUser({
    startDate,
    endDate,
    id,
  }: IPointsServiceFindAllCountByUser): Promise<number> {
    if ((startDate && !endDate) || (!startDate && endDate))
      throw new UnprocessableEntityException(
        '날짜 설정시 시작과 끝을 모두 지정해주세요.',
      );
    if (startDate && endDate) {
      const { endLocal } = setEndToLocal({ endDate });
      return await this.pointsRepository
        .createQueryBuilder('point')
        .leftJoinAndSelect('point.user', 'user')
        .where('point.user = :id', { id })
        .andWhere('point.createdAt BETWEEN :startDate AND :endLocal', {
          startDate,
          endLocal,
        })
        .getCount();
    } else {
      return await this.pointsRepository
        .createQueryBuilder('point')
        .leftJoinAndSelect('point.user', 'user')
        .where('point.user = :id', { id })
        .getCount();
    }
  }

  async createPointCharge({
    impUid,
    amount,
    id,
  }: IPointsServiceCreatePointCharge): Promise<Point> {
    await this.validateForPointCharge({ impUid, amount });
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');
    try {
      const target = await queryRunner.manager.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      const updatedUser = this.usersRepository.create({
        ...target,
        point: target.point + amount,
      });
      await queryRunner.manager.save(updatedUser);
      const payment = this.pointsRepository.create({
        impUid,
        amount,
        balance: updatedUser.point,
        status: POINT_TRANSACTION_STATUS_ENUM.PAID,
        user: updatedUser,
      });
      await queryRunner.manager.save(payment);
      await queryRunner.commitTransaction();
      return payment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  async validateForPointCharge({
    impUid,
    amount: _amount,
  }: IPointsServiceValidateForPointCharge): Promise<void> {
    const result = await this.pointsRepository.findOne({
      where: { impUid },
    });
    if (result) throw new ConflictException('이미 추가된 결제건입니다.');
    const { amount, status } = await this.iamportService.getPaymentData({
      impUid,
    });
    if (status !== 'paid') {
      throw new UnprocessableEntityException('결제가 완료되지 않았습니다.');
    }
    if (amount !== _amount) {
      throw new UnprocessableEntityException(
        '결제 금액 불일치! 위/변조 된 결제입니다.',
      );
    }
  }

  async cancelPointCharge({
    impUid,
    id,
  }: IPointsServiceCancelPointCharge): Promise<Point> {
    const { amount, user } = await this.validateForPointRefund({ impUid, id });
    const refundAmount = await this.iamportService.cancelTransaction({
      imp_uid: impUid,
      amount,
    });
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');
    try {
      const updatedUser = this.usersRepository.create({
        ...user,
        point: user.point - refundAmount,
      });
      await queryRunner.manager.save(updatedUser);
      const payment = this.pointsRepository.create({
        impUid,
        amount: -refundAmount,
        balance: updatedUser.point,
        status: POINT_TRANSACTION_STATUS_ENUM.CANCELLED,
        user: updatedUser,
      });
      await queryRunner.manager.save(payment);
      await queryRunner.commitTransaction();
      return payment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  async validateForPointRefund({
    impUid,
    id,
  }: IPointsServiceValidateForPointRefund): Promise<IPointsServiceValidateForPointRefundReturn> {
    const target = await this.usersRepository.findOne({ where: { id } });
    const result = await this.pointsRepository.findOne({
      where: { impUid },
    });
    if (!result) {
      throw new UnprocessableEntityException('존재하지 않는 결제건입니다.');
    }
    if (result.status === 'CANCELLED') {
      throw new UnprocessableEntityException('이미 취소된 결제 건입니다.');
    }

    if (target.point < result.amount) {
      throw new UnprocessableEntityException('환불이 불가능합니다.');
    }
    return { amount: result.amount, user: target };
  }
}
