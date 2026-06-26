import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LandingGalleryService } from './landing-gallery.service';

@ApiTags('landing-gallery')
@Controller('landing-gallery')
export class LandingGalleryController {
  constructor(private readonly landingGalleryService: LandingGalleryService) {}

  @ApiOperation({ summary: 'Get active landing gallery images' })
  @ApiOkResponse({ description: 'Landing gallery images returned.' })
  @Get()
  listImages() {
    return this.landingGalleryService.listPublicImages();
  }
}
