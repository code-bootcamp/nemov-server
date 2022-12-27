import { UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { IContext } from 'src/commons/types/context';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';
import { GqlAuthRefreshGuard } from 'src/commons/auth/gql-auth-guard';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly usersService: UsersService, //
    private readonly authService: AuthService,
  ) {}

  @Mutation(() => String)
  async login(
    @Args('email') email: string, //
    @Args('password') password: string,
    @Context() context: IContext,
  ): Promise<string> {
    // 로그인
    const user = await this.usersService.findOne({ email });
    if (!user)
      throw new UnprocessableEntityException('등록된 이메일이 아닙니다.');

    const isAuth = await bcrypt.compare(password, user.password);
    if (!isAuth)
      throw new UnprocessableEntityException('비밀번호가 틀렸습니다.');

    this.authService.setRefreshToken({ user, res: context.res });
    return this.authService.getAccessToken({ user });
  }

  @UseGuards(GqlAuthRefreshGuard)
  @Mutation(() => String)
  restoreAccessToken(
    @Context() context: IContext, //
  ): string {
    return this.authService.getAccessToken({ user: context.req.user });
  }
}