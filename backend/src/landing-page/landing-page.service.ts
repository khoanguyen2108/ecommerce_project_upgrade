import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateLandingPageDto } from './dto/update-landing-page.dto';

const LANDING_SETTING_ID = 'default';

const DEFAULT_HERO = {
  heroImageUrl: null,
  heroEyebrow: 'New season essentials',
  heroTitle: 'Elevate your everyday wardrobe',
  heroSubtitle:
    'Crisp cotton, soft tailoring, and easy layers selected for real days, repeat wear, and clean silhouettes.',
} as const;

const landingSettingSelect: Prisma.LandingPageSettingSelect = {
  heroImageUrl: true,
  heroEyebrow: true,
  heroTitle: true,
  heroSubtitle: true,
};

const featuredCategorySelect: Prisma.CategorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  featuredOrder: true,
};

@Injectable()
export class LandingPageService {
  constructor(private readonly prismaService: PrismaService) {}

  async getLandingPage() {
    const [setting, featuredCategories] = await this.prismaService.$transaction([
      this.prismaService.landingPageSetting.findUnique({
        where: { id: LANDING_SETTING_ID },
        select: landingSettingSelect,
      }),
      this.prismaService.category.findMany({
        where: {
          isActive: true,
          isFeatured: true,
        },
        orderBy: [{ featuredOrder: 'asc' }, { createdAt: 'asc' }],
        take: 3,
        select: featuredCategorySelect,
      }),
    ]);

    return {
      hero: this.withHeroDefaults(setting),
      featuredCategories,
    };
  }

  async getAdminLandingPage() {
    const landingPage = await this.getLandingPage();

    return {
      ...landingPage.hero,
      featuredCategories: landingPage.featuredCategories,
    };
  }

  async updateAdminLandingPage(dto: UpdateLandingPageDto) {
    const data: {
      heroImageUrl?: string | null;
      heroEyebrow?: string | null;
      heroTitle?: string | null;
      heroSubtitle?: string | null;
    } = {};

    if ('heroImageUrl' in dto) {
      data.heroImageUrl = this.normalizeHeroImageUrl(dto.heroImageUrl);
    }

    if ('heroEyebrow' in dto) {
      data.heroEyebrow = this.normalizeHeroText(
        dto.heroEyebrow,
        120,
        'ADMIN_LANDING_TITLE_INVALID',
        'Hero eyebrow',
      );
    }

    if ('heroTitle' in dto) {
      data.heroTitle = this.normalizeHeroText(
        dto.heroTitle,
        160,
        'ADMIN_LANDING_TITLE_INVALID',
        'Hero title',
      );
    }

    if ('heroSubtitle' in dto) {
      data.heroSubtitle = this.normalizeHeroText(
        dto.heroSubtitle,
        300,
        'ADMIN_LANDING_SUBTITLE_INVALID',
        'Hero subtitle',
      );
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code: 'ADMIN_LANDING_UPDATE_EMPTY',
        message: 'Provide at least one landing page field to update.',
      });
    }

    const setting = await this.prismaService.landingPageSetting.upsert({
      where: { id: LANDING_SETTING_ID },
      create: {
        id: LANDING_SETTING_ID,
        ...data,
      },
      update: data,
      select: landingSettingSelect,
    });
    const featuredCategories = await this.listFeaturedCategories();

    return {
      ...this.withHeroDefaults(setting),
      featuredCategories,
    };
  }

  private listFeaturedCategories() {
    return this.prismaService.category.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      orderBy: [{ featuredOrder: 'asc' }, { createdAt: 'asc' }],
      take: 3,
      select: featuredCategorySelect,
    });
  }

  private withHeroDefaults(
    setting:
      | {
          heroImageUrl: string | null;
          heroEyebrow: string | null;
          heroTitle: string | null;
          heroSubtitle: string | null;
        }
      | null,
  ) {
    return {
      heroImageUrl: setting?.heroImageUrl ?? DEFAULT_HERO.heroImageUrl,
      heroEyebrow: setting?.heroEyebrow ?? DEFAULT_HERO.heroEyebrow,
      heroTitle: setting?.heroTitle ?? DEFAULT_HERO.heroTitle,
      heroSubtitle: setting?.heroSubtitle ?? DEFAULT_HERO.heroSubtitle,
    };
  }

  private normalizeHeroImageUrl(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();

    if (!normalized) {
      return null;
    }

    if (normalized.length > 2048) {
      throw new BadRequestException({
        code: 'ADMIN_LANDING_HERO_IMAGE_URL_INVALID',
        message: 'Hero image URL must be a valid public HTTP or HTTPS URL.',
      });
    }

    try {
      const url = new URL(normalized);

      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Unsupported protocol');
      }
    } catch {
      throw new BadRequestException({
        code: 'ADMIN_LANDING_HERO_IMAGE_URL_INVALID',
        message: 'Hero image URL must be a valid public HTTP or HTTPS URL.',
      });
    }

    return normalized;
  }

  private normalizeHeroText(
    value: string | null | undefined,
    maxLength: number,
    code: string,
    label: string,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      return null;
    }

    if (
      normalized.length > maxLength ||
      /<[^>]*>|javascript\s*:/i.test(normalized)
    ) {
      throw new BadRequestException({
        code,
        message: `${label} contains invalid content.`,
      });
    }

    return normalized;
  }
}
