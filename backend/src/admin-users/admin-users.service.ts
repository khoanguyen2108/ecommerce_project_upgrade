import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminUserOrder,
  AdminUserQueryDto,
  AdminUserSort,
} from './dto/admin-user-query.dto';
import type { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import type { UpdateUserRoleDto } from './dto/update-user-role.dto';
import type { UpdateUserStatusDto } from './dto/update-user-status.dto';

const DEFAULT_ADMIN_USER_LIMIT = 20;
const MAX_ADMIN_USER_LIMIT = 100;

const adminUserSelect: Prisma.UserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  authProvider: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class AdminUsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async listUsers(query: AdminUserQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(
      query.limit ?? DEFAULT_ADMIN_USER_LIMIT,
      MAX_ADMIN_USER_LIMIT,
    );
    const where = this.buildUserWhere(query);

    const [total, users] = await this.prismaService.$transaction([
      this.prismaService.user.count({ where }),
      this.prismaService.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.getUserOrderBy(query.sort, query.order),
        select: adminUserSelect,
      }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getUser(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      select: adminUserSelect,
    });

    if (!user) {
      throw this.userNotFoundException();
    }

    return { user };
  }

  async updateUser(id: string, dto: UpdateAdminUserDto) {
    await this.assertUserExists(id);

    const data: Prisma.UserUpdateInput = {};

    if ('name' in dto) {
      data.name = this.normalizeOptionalText(dto.name);
    }

    if ('phone' in dto) {
      data.phone = this.normalizeOptionalText(dto.phone);
    }

    this.assertUpdateHasFields(data, 'ADMIN_USER_UPDATE_EMPTY');

    const user = await this.prismaService.user.update({
      where: { id },
      data,
      select: adminUserSelect,
    });

    return { user };
  }

  async updateUserStatus(
    id: string,
    dto: UpdateUserStatusDto,
    actorUserId: string,
  ) {
    const user = await this.prismaService.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id },
        select: adminUserSelect,
      });

      if (!currentUser) {
        throw this.userNotFoundException();
      }

      if (
        currentUser.role === UserRole.ADMIN &&
        currentUser.isActive &&
        !dto.isActive
      ) {
        await this.assertNotLastActiveAdmin(tx, currentUser.id);
      }

      if (currentUser.id === actorUserId && !dto.isActive) {
        await this.assertSelfStatusChangeIsSafe(tx, currentUser.id);
      }

      return tx.user.update({
        where: { id },
        data: {
          isActive: dto.isActive,
          ...(dto.isActive
            ? {}
            : {
                refreshTokenHash: null,
                refreshTokenExpiresAt: null,
              }),
        },
        select: adminUserSelect,
      });
    });

    return { user };
  }

  async updateUserRole(
    id: string,
    dto: UpdateUserRoleDto,
    actorUserId: string,
  ) {
    const user = await this.prismaService.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id },
        select: adminUserSelect,
      });

      if (!currentUser) {
        throw this.userNotFoundException();
      }

      if (
        currentUser.role === UserRole.ADMIN &&
        currentUser.isActive &&
        dto.role !== UserRole.ADMIN
      ) {
        await this.assertNotLastActiveAdmin(tx, currentUser.id);
      }

      if (currentUser.id === actorUserId && dto.role !== UserRole.ADMIN) {
        await this.assertSelfRoleChangeIsSafe(tx, currentUser.id);
      }

      return tx.user.update({
        where: { id },
        data: {
          role: dto.role,
        },
        select: adminUserSelect,
      });
    });

    return { user };
  }

  async deleteUser(id: string, actorUserId: string) {
    if (id === actorUserId) {
      throw new ConflictException({
        code: 'USER_DELETE_SELF_BLOCKED',
        message: 'You cannot delete the admin account you are currently using.',
      });
    }

    const user = await this.prismaService.user.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
        role: true,
        cart: { select: { id: true } },
        _count: {
          select: {
            addresses: true,
            orders: true,
            passwordResetOtps: true,
          },
        },
      },
    });

    if (!user) {
      throw this.userNotFoundException();
    }

    if (
      user.cart ||
      user._count.addresses > 0 ||
      user._count.orders > 0 ||
      user._count.passwordResetOtps > 0
    ) {
      throw new ConflictException({
        code: 'USER_DELETE_BLOCKED',
        message:
          'This user cannot be deleted because related records exist. Deactivate the user instead.',
      });
    }

    if (user.role === UserRole.ADMIN && user.isActive) {
      await this.assertNotLastActiveAdmin(this.prismaService, id);
    }

    await this.prismaService.user.delete({ where: { id } });
    return { deletedId: id };
  }

  private buildUserWhere(query: AdminUserQueryDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    const search = this.normalizeOptionalQueryText(query.search);

    if (search) {
      where.OR = [
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.authProvider) {
      where.authProvider = query.authProvider;
    }

    return where;
  }

  private getUserOrderBy(
    sort: AdminUserSort = 'createdAt',
    order: AdminUserOrder = 'desc',
  ): Prisma.UserOrderByWithRelationInput[] {
    return [{ [sort]: order }, { id: 'asc' }];
  }

  private async assertUserExists(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw this.userNotFoundException();
    }
  }

  private async assertNotLastActiveAdmin(
    tx: Pick<PrismaService, 'user'>,
    userId: string,
  ) {
    const activeAdminCount = await tx.user.count({
      where: {
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    if (activeAdminCount <= 1) {
      throw new ConflictException({
        code: 'LAST_ACTIVE_ADMIN',
        message: 'At least one active admin account must remain.',
      });
    }

    const currentUser = await tx.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        isActive: true,
      },
    });

    if (
      !currentUser ||
      currentUser.role !== UserRole.ADMIN ||
      !currentUser.isActive
    ) {
      throw this.userNotFoundException();
    }
  }

  private async assertSelfStatusChangeIsSafe(
    tx: Pick<PrismaService, 'user'>,
    userId: string,
  ) {
    const otherActiveAdminCount = await tx.user.count({
      where: {
        id: {
          not: userId,
        },
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    if (otherActiveAdminCount < 1) {
      throw new ConflictException({
        code: 'LAST_ACTIVE_ADMIN',
        message: 'You cannot deactivate the only active admin account.',
      });
    }
  }

  private async assertSelfRoleChangeIsSafe(
    tx: Pick<PrismaService, 'user'>,
    userId: string,
  ) {
    const otherActiveAdminCount = await tx.user.count({
      where: {
        id: {
          not: userId,
        },
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    if (otherActiveAdminCount < 1) {
      throw new ConflictException({
        code: 'LAST_ACTIVE_ADMIN',
        message: 'You cannot demote the only active admin account.',
      });
    }
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim().replace(/\s+/g, ' ');

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeOptionalQueryText(value: string | undefined): string | undefined {
    const normalized = value?.trim().replace(/\s+/g, ' ');

    return normalized ? normalized : undefined;
  }

  private assertUpdateHasFields(data: object, code: string) {
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code,
        message: 'Provide at least one field to update.',
      });
    }
  }

  private userNotFoundException() {
    return new NotFoundException({
      code: 'USER_NOT_FOUND',
      message: 'User was not found.',
    });
  }
}
