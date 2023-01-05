import {
  Injectable,
  UnprocessableEntityException,
  CACHE_MANAGER,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IContext } from 'src/commons/types/context';
import { Cache } from 'cache-manager';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService, //

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  setRefreshToken({ id, res, req }): void {
    const refreshToken = this.jwtService.sign(
      { id },
      { secret: process.env.JWT_REFRESH_KEY, expiresIn: '2w' },
    );

    if (process.env.DEPLOY_ENV === 'LOCAL') {
      res.setHeader('Set-Cookie', `refreshToken=${refreshToken}`);
    } else {
      const allowedOrigins = [
        'http://localhost:3000',
        'https://code-backend.shop/graphql',
        'https://nemov.store',
      ];

      const origin = req.headers.origin;
      if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,HEAD,OPTIONS,POST,PUT',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers',
      );
      res.setHeader(
        'Set-Cookie',
        `refreshToken=${refreshToken}; path=/; domain=.code-backend.shop; SameSite=None; Secure; httpOnly;`,
      );
    }
  }

  getAccessToken({ id }): string {
    return this.jwtService.sign(
      { id },
      { secret: process.env.JWT_ACCESS_KEY, expiresIn: '1h' },
    );
  }

  async logout({ req, res }: IContext) {
    const accessToken = req.headers.authorization.replace('Bearer ', '');

    const refreshToken = req.headers.cookie.replace('refreshToken=', '');

    const verifiedAccess = jwt.verify(accessToken, process.env.JWT_ACCESS_KEY);

    const verifiedRefresh = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_KEY,
    );

    const current = new Date().getTime();

    const ttlOfAccess = Math.trunc(
      (verifiedAccess['exp'] * 1000 - current) / 1000,
    );

    const ttlOfRefresh = Math.trunc(
      (verifiedRefresh['exp'] * 1000 - current) / 1000,
    );

    try {
      verifiedAccess;
      await this.cacheManager.set(
        `accessToken = ${accessToken}`,
        'accessToken',
        { ttl: ttlOfAccess },
      );

      verifiedRefresh;
      await this.cacheManager.set(
        `refreshToken = ${refreshToken}`,
        'refreshToken',
        { ttl: ttlOfRefresh },
      );
    } catch (error) {
      throw new UnprocessableEntityException(error);
    }

    if (process.env.DEPLOY_ENV === 'LOCAL') {
      res.setHeader('Set-Cookie', `refreshToken=`);
    } else {
      res.setHeader(
        'Set-Cookie',
        `refreshToken=; path=/; domain=.code-backend.shop; SameSite=None; Secure; httpOnly;`,
      );
    }

    return '로그아웃 성공';
  }
}
