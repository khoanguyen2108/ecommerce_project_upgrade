import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAddressDto } from './dto/address-fields.dto';
import type { UpdateAddressDto } from './dto/update-address.dto';

export const addressResponseSelect = {
  id: true,
  recipientName: true,
  phone: true,
  province: true,
  district: true,
  ward: true,
  addressLine: true,
  note: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.AddressSelect;

@Injectable()
export class AddressesService {
  constructor(private readonly prismaService: PrismaService) {}

  async list(user: AuthenticatedUser) {
    const addresses = await this.prismaService.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: addressResponseSelect,
    });

    return { addresses };
  }

  async create(user: AuthenticatedUser, dto: CreateAddressDto) {
    const address = await this.prismaService.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId: user.id } });
      const isDefault = count === 0 || dto.isDefault === true;

      if (isDefault) {
        await tx.address.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: this.toCreateData(user.id, dto, isDefault),
        select: addressResponseSelect,
      });
    });

    return { address };
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateAddressDto) {
    await this.requireOwnedAddress(user.id, id);
    const address = await this.prismaService.address.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.note !== undefined ? { note: dto.note || null } : {}),
      },
      select: addressResponseSelect,
    });

    return { address };
  }

  async remove(user: AuthenticatedUser, id: string) {
    const removed = await this.prismaService.$transaction(async (tx) => {
      const address = await tx.address.findFirst({
        where: { id, userId: user.id },
        select: { id: true, isDefault: true },
      });
      if (!address) throw this.notFoundException();

      await tx.address.delete({ where: { id } });

      if (address.isDefault) {
        const replacement = await tx.address.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (replacement) {
          await tx.address.update({
            where: { id: replacement.id },
            data: { isDefault: true },
          });
        }
      }

      return address;
    });

    return { deleted: true, id: removed.id };
  }

  async setDefault(user: AuthenticatedUser, id: string) {
    const address = await this.prismaService.$transaction(async (tx) => {
      const owned = await tx.address.findFirst({
        where: { id, userId: user.id },
        select: { id: true },
      });
      if (!owned) throw this.notFoundException();

      await tx.address.updateMany({
        where: { userId: user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      return tx.address.update({
        where: { id },
        data: { isDefault: true },
        select: addressResponseSelect,
      });
    });

    return { address };
  }

  private async requireOwnedAddress(userId: string, id: string) {
    const address = await this.prismaService.address.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!address) throw this.notFoundException();
  }

  private toCreateData(userId: string, dto: CreateAddressDto, isDefault: boolean) {
    return {
      userId,
      recipientName: dto.recipientName,
      phone: dto.phone,
      province: dto.province,
      district: dto.district,
      ward: dto.ward,
      addressLine: dto.addressLine,
      note: dto.note || null,
      isDefault,
    };
  }

  private notFoundException() {
    return new NotFoundException({
      code: 'ADDRESS_NOT_FOUND',
      message: 'Address was not found.',
    });
  }
}
