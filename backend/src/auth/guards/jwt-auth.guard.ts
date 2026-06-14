import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTH_ACCESS_TOKEN_COOKIE } from '../auth-cookie.constants';
import type {
  AccessTokenPayload,
  AuthenticatedRequest,
} from '../types/authenticated-user';

const authUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  authProvider: true,
  isActive: true,
} as const;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required.',
      });
    }

    const payload = await this.verifyToken(token);

    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired.',
      });
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      select: authUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired.',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is inactive.',
      });
    }

    request.user = user;
    return true;
  }

  private extractBearerToken(request: AuthenticatedRequest): string | undefined {
    const authorization = request.header('authorization');

    if (authorization) {
      const [scheme, token] = authorization.split(' ');

      if (scheme?.toLowerCase() === 'bearer' && token) {
        return token;
      }
    }

    return this.getCookie(request, AUTH_ACCESS_TOKEN_COOKIE);
  }

  private getCookie(
    request: AuthenticatedRequest,
    name: string,
  ): string | undefined {
    const cookieHeader = request.header('cookie');

    if (!cookieHeader) {
      return undefined;
    }

    for (const cookie of cookieHeader.split(';')) {
      const [rawName, ...rawValue] = cookie.trim().split('=');

      if (rawName === name) {
        try {
          return decodeURIComponent(rawValue.join('='));
        } catch {
          return undefined;
        }
      }
    }

    return undefined;
  }

  private async verifyToken(token: string): Promise<AccessTokenPayload> {
    const secret = this.configService.get<string>('JWT_SECRET')?.trim();

    if (!secret) {
      throw new InternalServerErrorException({
        code: 'AUTH_CONFIGURATION_ERROR',
        message: 'Authentication is not configured.',
      });
    }

    try {
      return await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired.',
      });
    }
  }
}
