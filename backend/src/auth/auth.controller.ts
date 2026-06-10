import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  authTokenDataExample,
  currentUserDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
  logoutDataExample,
  passwordResetCompleteDataExample,
  passwordResetRequestDataExample,
  passwordResetVerifiedDataExample,
  updatedUserDataExample,
} from '../common/swagger/api-examples';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/swagger/api-docs.constants';
import {
  AUTH_ACCESS_TOKEN_COOKIE,
  AUTH_REFRESH_TOKEN_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
} from './auth-cookie.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { ForgotPasswordRequestOtpDto } from './dto/forgot-password-request-otp.dto';
import { ForgotPasswordResetDto } from './dto/forgot-password-reset.dto';
import { ForgotPasswordVerifyOtpDto } from './dto/forgot-password-verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './types/authenticated-user';

const secondsToMilliseconds = (seconds: number) => seconds * 1000;

const getPositiveEnvNumber = (key: string, defaultValue: number): number => {
  const value = Number(process.env[key] ?? defaultValue);

  return Number.isFinite(value) && value > 0 ? value : defaultValue;
};

const getAuthRateLimitTtl = () =>
  secondsToMilliseconds(getPositiveEnvNumber('AUTH_RATE_LIMIT_TTL', 60));

const getAuthRateLimitMax = () => getPositiveEnvNumber('AUTH_RATE_LIMIT_MAX', 5);

const getRefreshRateLimitMax = () =>
  Math.max(1, Math.floor(getAuthRateLimitMax() / 2));

const getForgotPasswordRequestRateLimitTtl = () => secondsToMilliseconds(300);

const getForgotPasswordRequestRateLimitMax = () => 3;

const getForgotPasswordVerifyRateLimitTtl = () => secondsToMilliseconds(60);

const getForgotPasswordVerifyRateLimitMax = () => 5;

const getOAuthStateCookieMaxAgeSeconds = () => 10 * 60;

type SameSiteCookieMode = 'Strict' | 'Lax' | 'None';

interface CookieOptions {
  httpOnly?: boolean;
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: SameSiteCookieMode;
  secure?: boolean;
}

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register with email and password' })
  @ApiCreatedResponse(
    envelopeResponse('Customer account created and tokens issued.', authTokenDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Request validation failed.',
      'BAD_REQUEST',
      'email must be an email',
    ),
  )
  @ApiConflictResponse(
    errorEnvelopeResponse(
      'Email is already registered.',
      'EMAIL_ALREADY_REGISTERED',
      'An account with this email already exists.',
    ),
  )
  @Post('register')
  @Throttle({
    default: {
      ttl: getAuthRateLimitTtl,
      limit: getAuthRateLimitMax,
    },
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse(
    envelopeResponse('Credentials accepted and tokens issued.', authTokenDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Request validation failed.',
      'BAD_REQUEST',
      'email must be an email',
    ),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Credentials are invalid.',
      'INVALID_CREDENTIALS',
      'Invalid email or password.',
    ),
  )
  @Post('login')
  @HttpCode(200)
  @Throttle({
    default: {
      ttl: getAuthRateLimitTtl,
      limit: getAuthRateLimitMax,
    },
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({ summary: 'Logout the current user' })
  @ApiOkResponse(
    envelopeResponse('Refresh token was revoked.', logoutDataExample),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Authentication is required.',
      'AUTH_REQUIRED',
      'Authentication is required.',
    ),
  )
  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id);
  }

  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiOkResponse(
    envelopeResponse('Current user profile returned.', currentUserDataExample),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Authentication is required.',
      'AUTH_REQUIRED',
      'Authentication is required.',
    ),
  )
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }

  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({ summary: 'Update the current authenticated user profile' })
  @ApiOkResponse(
    envelopeResponse('Current user profile updated.', updatedUserDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'No profile fields were provided or validation failed.',
      'PROFILE_UPDATE_EMPTY',
      'Provide at least one profile field to update.',
    ),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Authentication is required.',
      'AUTH_REQUIRED',
      'Authentication is required.',
    ),
  )
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(user.id, dto);
  }

  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiOkResponse(
    envelopeResponse('Refresh token accepted and new tokens issued.', authTokenDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Request validation failed.',
      'BAD_REQUEST',
      'refreshToken must be longer than or equal to 32 characters',
    ),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Refresh token is invalid or expired.',
      'REFRESH_TOKEN_INVALID',
      'Refresh token is invalid or expired.',
    ),
  )
  @Post('refresh')
  @HttpCode(200)
  @Throttle({
    default: {
      ttl: getAuthRateLimitTtl,
      limit: getRefreshRateLimitMax,
    },
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @ApiOperation({ summary: 'Start Google OAuth login' })
  @ApiFoundResponse({
    description:
      'Redirects to Google OAuth consent. No client ID or secret is exposed.',
  })
  @Get('google')
  @Throttle({
    default: {
      ttl: getAuthRateLimitTtl,
      limit: getAuthRateLimitMax,
    },
  })
  googleLogin(@Res() response: Response) {
    try {
      const { authorizationUrl, state } =
        this.authService.getGoogleAuthorizationUrl();

      this.appendCookie(response, GOOGLE_OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        maxAgeSeconds: getOAuthStateCookieMaxAgeSeconds(),
        path: '/',
        sameSite: 'Lax',
        secure: this.shouldUseSecureCookies(),
      });

      return response.redirect(302, authorizationUrl);
    } catch {
      return this.redirectToOAuthFailure(response, 'oauth_configuration');
    }
  }

  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @ApiQuery({
    description: 'Authorization code returned by Google.',
    name: 'code',
    required: false,
  })
  @ApiQuery({
    description: 'OAuth state value matched against the HTTP-only state cookie.',
    name: 'state',
    required: false,
  })
  @ApiQuery({
    description: 'Provider error value when Google rejects the OAuth request.',
    name: 'error',
    required: false,
  })
  @ApiFoundResponse({
    description:
      'Redirects to the configured frontend success or failure URL. Successful callbacks may set HTTP-only auth cookies.',
  })
  @Get('google/callback')
  @Throttle({
    default: {
      ttl: getAuthRateLimitTtl,
      limit: getAuthRateLimitMax,
    },
  })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    this.clearCookie(response, GOOGLE_OAUTH_STATE_COOKIE);

    if (error) {
      return this.redirectToOAuthFailure(response, 'provider_error');
    }

    if (
      !this.isSafeOAuthQueryValue(code, 2048) ||
      !this.isSafeOAuthQueryValue(state, 256) ||
      !this.isOAuthStateValid(request, state)
    ) {
      return this.redirectToOAuthFailure(response, 'invalid_state');
    }

    try {
      const tokenResponse =
        await this.authService.loginWithGoogleCallback(code);

      this.appendCookie(response, AUTH_ACCESS_TOKEN_COOKIE, tokenResponse.accessToken, {
        httpOnly: true,
        maxAgeSeconds: this.authService.getAccessTokenCookieMaxAgeSeconds(),
        path: '/',
        sameSite: 'Lax',
        secure: this.shouldUseSecureCookies(),
      });
      this.appendCookie(
        response,
        AUTH_REFRESH_TOKEN_COOKIE,
        tokenResponse.refreshToken,
        {
          httpOnly: true,
          maxAgeSeconds: this.authService.getRefreshTokenCookieMaxAgeSeconds(),
          path: '/',
          sameSite: 'Lax',
          secure: this.shouldUseSecureCookies(),
        },
      );

      return response.redirect(
        302,
        this.authService.buildOAuthSuccessRedirectUrl(),
      );
    } catch {
      return this.redirectToOAuthFailure(response, 'oauth_failed');
    }
  }

  @ApiOperation({
    summary: 'Request a forgot-password OTP',
    description:
      'Response is intentionally generic and must not reveal whether the email exists.',
  })
  @ApiOkResponse(
    envelopeResponse(
      'Password reset OTP request accepted.',
      passwordResetRequestDataExample,
    ),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Request validation failed.',
      'BAD_REQUEST',
      'email must be an email',
    ),
  )
  @Post('forgot-password/request-otp')
  @HttpCode(200)
  @Throttle({
    default: {
      ttl: getForgotPasswordRequestRateLimitTtl,
      limit: getForgotPasswordRequestRateLimitMax,
    },
  })
  requestPasswordResetOtp(@Body() dto: ForgotPasswordRequestOtpDto) {
    return this.authService.requestPasswordResetOtp(dto);
  }

  @ApiOperation({ summary: 'Verify a forgot-password OTP' })
  @ApiOkResponse(
    envelopeResponse(
      'Password reset OTP verified.',
      passwordResetVerifiedDataExample,
    ),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Request validation failed.',
      'BAD_REQUEST',
      'otp must match /^\\d{6}$/ regular expression',
    ),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Password reset OTP is invalid or expired.',
      'PASSWORD_RESET_OTP_INVALID',
      'Password reset code is invalid or expired.',
    ),
  )
  @Post('forgot-password/verify-otp')
  @HttpCode(200)
  @Throttle({
    default: {
      ttl: getForgotPasswordVerifyRateLimitTtl,
      limit: getForgotPasswordVerifyRateLimitMax,
    },
  })
  verifyPasswordResetOtp(@Body() dto: ForgotPasswordVerifyOtpDto) {
    return this.authService.verifyPasswordResetOtp(dto);
  }

  @ApiOperation({ summary: 'Reset password with a verified OTP' })
  @ApiOkResponse(
    envelopeResponse('Password reset completed.', passwordResetCompleteDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Request validation failed.',
      'BAD_REQUEST',
      'newPassword must be longer than or equal to 8 characters',
    ),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Password reset OTP is invalid or expired.',
      'PASSWORD_RESET_OTP_INVALID',
      'Password reset code is invalid or expired.',
    ),
  )
  @Post('forgot-password/reset')
  @HttpCode(200)
  @Throttle({
    default: {
      ttl: getForgotPasswordVerifyRateLimitTtl,
      limit: getForgotPasswordVerifyRateLimitMax,
    },
  })
  resetPassword(@Body() dto: ForgotPasswordResetDto) {
    return this.authService.resetPassword(dto);
  }

  private redirectToOAuthFailure(response: Response, reason: string) {
    try {
      return response.redirect(
        302,
        this.authService.buildOAuthFailureRedirectUrl(reason),
      );
    } catch {
      return response.status(503).send('Google login is not configured.');
    }
  }

  private appendCookie(
    response: Response,
    name: string,
    value: string,
    options: CookieOptions,
  ) {
    response.append('Set-Cookie', this.serializeCookie(name, value, options));
  }

  private clearCookie(response: Response, name: string) {
    this.appendCookie(response, name, '', {
      httpOnly: true,
      maxAgeSeconds: 0,
      path: '/',
      sameSite: 'Lax',
      secure: this.shouldUseSecureCookies(),
    });
  }

  private serializeCookie(
    name: string,
    value: string,
    options: CookieOptions,
  ): string {
    const cookieParts = [
      `${name}=${encodeURIComponent(value)}`,
      `Path=${options.path ?? '/'}`,
    ];

    if (options.maxAgeSeconds !== undefined) {
      cookieParts.push(`Max-Age=${Math.max(0, options.maxAgeSeconds)}`);
    }

    if (options.httpOnly) {
      cookieParts.push('HttpOnly');
    }

    if (options.secure) {
      cookieParts.push('Secure');
    }

    if (options.sameSite) {
      cookieParts.push(`SameSite=${options.sameSite}`);
    }

    return cookieParts.join('; ');
  }

  private isOAuthStateValid(request: Request, state: string): boolean {
    return this.getCookie(request, GOOGLE_OAUTH_STATE_COOKIE) === state;
  }

  private getCookie(request: Request, name: string): string | undefined {
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

  private isSafeOAuthQueryValue(
    value: string | undefined,
    maxLength: number,
  ): value is string {
    return Boolean(value && value.length <= maxLength);
  }

  private shouldUseSecureCookies(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
