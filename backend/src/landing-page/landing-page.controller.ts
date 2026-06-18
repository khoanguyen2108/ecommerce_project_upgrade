import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LandingPageService } from './landing-page.service';

@ApiTags('landing-page')
@Controller('landing-page')
export class LandingPageController {
  constructor(private readonly landingPageService: LandingPageService) {}

  @ApiOperation({ summary: 'Get public landing page content' })
  @ApiOkResponse({ description: 'Landing page content returned.' })
  @Get()
  getLandingPage() {
    return this.landingPageService.getLandingPage();
  }
}
