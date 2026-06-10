import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../generated/prisma/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required.',
      });
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource.',
      });
    }

    return true;
  }
}
