import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { EmailService } from "../email/email.service";
import {
  AuthProvider,
  type UserRole,
  UserRole as UserRoleValue,
} from "../generated/prisma/enums";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ForgotPasswordRequestOtpDto } from "./dto/forgot-password-request-otp.dto";
import type { ForgotPasswordResetDto } from "./dto/forgot-password-reset.dto";
import type { ForgotPasswordVerifyOtpDto } from "./dto/forgot-password-verify-otp.dto";
import type { LoginDto } from "./dto/login.dto";
import type { RefreshTokenDto } from "./dto/refresh-token.dto";
import type { RegisterDto } from "./dto/register.dto";
import type { UpdateMeDto } from "./dto/update-me.dto";
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from "./types/authenticated-user";

const PASSWORD_HASH_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_ACCESS_TOKEN_EXPIRES_IN: JwtSignOptions["expiresIn"] = "15m";
const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_OAUTH_SCOPE = "openid email profile";
const OAUTH_STATE_BYTES = 32;
const PASSWORD_RESET_OTP_TTL_MS = 60 * 1000;
const PASSWORD_RESET_OTP_DIGITS = 6;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const DEFAULT_ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS = 15 * 60;

const passwordResetRequestMessage =
  "If an account exists for that email, a password reset code has been sent.";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  authProvider: true,
  createdAt: true,
  updatedAt: true,
} as const;

const credentialUserSelect = {
  ...publicUserSelect,
  passwordHash: true,
  refreshTokenHash: true,
  refreshTokenExpiresAt: true,
} as const;

const googleLinkedUserSelect = {
  ...publicUserSelect,
  googleId: true,
  emailVerified: true,
} as const;

const passwordResetOtpSelect = {
  id: true,
  userId: true,
  email: true,
  otpHash: true,
  expiresAt: true,
  usedAt: true,
  attempts: true,
  createdAt: true,
} as const;

type PublicUserRecord = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  createdAt: Date;
  updatedAt: Date;
};

type CredentialUserRecord = PublicUserRecord & {
  passwordHash: string | null;
  refreshTokenHash: string | null;
  refreshTokenExpiresAt: Date | null;
};

type GoogleLinkedUserRecord = PublicUserRecord & {
  googleId: string | null;
  emailVerified: boolean;
};

type PasswordResetOtpRecord = {
  id: string;
  userId: string;
  email: string;
  otpHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  attempts: number;
  createdAt: Date;
};

type PasswordResetOtpClient = {
  passwordResetOtp: PrismaService["passwordResetOtp"];
};

type PasswordResetClient = PasswordResetOtpClient & {
  user: PrismaService["user"];
};

interface GoogleTokenResponse {
  id_token?: string;
}

interface GoogleTokenInfoResponse {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  exp?: string;
}

interface GoogleProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

export interface PublicUserResponse extends AuthenticatedUser {
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokenResponse {
  user: PublicUserResponse;
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: JwtSignOptions["expiresIn"];
}

export interface GoogleAuthorizationResponse {
  authorizationUrl: string;
  state: string;
}

export interface PasswordResetResponse {
  success: true;
  message: string;
}

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: JwtSignOptions["expiresIn"];

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly emailService: EmailService,
  ) {
    this.accessTokenExpiresIn =
      this.configService.get<JwtSignOptions["expiresIn"]>("JWT_EXPIRES_IN") ??
      DEFAULT_ACCESS_TOKEN_EXPIRES_IN;
  }

  async register(dto: RegisterDto): Promise<AuthTokenResponse> {
    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.prismaService.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw this.emailAlreadyRegisteredException();
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);
    const user = await this.createCustomerUser(dto, email, passwordHash);

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prismaService.user.findUnique({
      where: { email },
      select: credentialUserSelect,
    });

    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<{ success: true }> {
    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    return { success: true };
  }

  async getMe(user: AuthenticatedUser): Promise<{ user: AuthenticatedUser }> {
    return { user };
  }

  async updateMe(
    userId: string,
    dto: UpdateMeDto,
  ): Promise<{ user: PublicUserResponse }> {
    const data: { name?: string | null; phone?: string | null } = {};

    if ("name" in dto) {
      data.name = this.normalizeOptionalText(dto.name);
    }

    if ("phone" in dto) {
      data.phone = this.normalizeOptionalText(dto.phone);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code: "PROFILE_UPDATE_EMPTY",
        message: "Provide at least one profile field to update.",
      });
    }

    const user = await this.prismaService.user.update({
      where: { id: userId },
      data,
      select: publicUserSelect,
    });

    return { user: this.mapPublicUser(user) };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokenResponse> {
    const refreshTokenHash = this.hashRefreshToken(dto.refreshToken);
    const user = await this.prismaService.user.findFirst({
      where: { refreshTokenHash },
      select: credentialUserSelect,
    });

    if (
      !user?.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException({
        code: "REFRESH_TOKEN_INVALID",
        message: "Refresh token is invalid or expired.",
      });
    }

    return this.issueTokens(user, refreshTokenHash);
  }

  getGoogleAuthorizationUrl(): GoogleAuthorizationResponse {
    const clientId = this.getRequiredConfig("GOOGLE_CLIENT_ID");
    const callbackUrl = this.getRequiredConfig("GOOGLE_CALLBACK_URL");
    const state = this.createOAuthState();
    const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_URL);

    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", GOOGLE_OAUTH_SCOPE);
    authorizationUrl.searchParams.set("state", state);

    return {
      authorizationUrl: authorizationUrl.toString(),
      state,
    };
  }

  async loginWithGoogleCallback(code: string): Promise<AuthTokenResponse> {
    const idToken = await this.exchangeGoogleCodeForIdToken(code);
    const profile = await this.getVerifiedGoogleProfile(idToken);
    const user = await this.findOrCreateGoogleUser(profile);

    return this.issueTokens(user);
  }

  buildOAuthSuccessRedirectUrl(): string {
    return this.buildRedirectUrl(
      this.getRequiredConfig("FRONTEND_AUTH_SUCCESS_URL"),
      {
        provider: "google",
        status: "success",
      },
    );
  }

  buildOAuthFailureRedirectUrl(reason = "oauth_failed"): string {
    return this.buildRedirectUrl(
      this.getRequiredConfig("FRONTEND_AUTH_FAILURE_URL"),
      {
        provider: "google",
        status: "failed",
        reason,
      },
    );
  }

  getAccessTokenCookieMaxAgeSeconds(): number {
    return this.parseExpiresInSeconds(this.accessTokenExpiresIn);
  }

  getRefreshTokenCookieMaxAgeSeconds(): number {
    return Math.floor(REFRESH_TOKEN_TTL_MS / 1000);
  }

  async requestPasswordResetOtp(
    dto: ForgotPasswordRequestOtpDto,
  ): Promise<PasswordResetResponse> {
    const email = this.normalizeEmail(dto.email);
    const otpSecret = this.getJwtSecret();
    const user = await this.prismaService.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      return this.passwordResetRequestResponse();
    }

    const otp = this.createPasswordResetOtp();
    const now = new Date();
    const otpHash = this.hashPasswordResetOtp(user.email, otp, otpSecret);
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_OTP_TTL_MS);

    await this.prismaService.$transaction([
      this.prismaService.passwordResetOtp.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      }),
      this.prismaService.passwordResetOtp.create({
        data: {
          userId: user.id,
          email: user.email,
          otpHash,
          expiresAt,
        },
      }),
    ]);

    await this.emailService.sendPasswordResetOtp(user.email, otp);

    return this.passwordResetRequestResponse();
  }

  async verifyPasswordResetOtp(
    dto: ForgotPasswordVerifyOtpDto,
  ): Promise<PasswordResetResponse> {
    const email = this.normalizeEmail(dto.email);
    const otpSecret = this.getJwtSecret();

    await this.getValidPasswordResetOtp(
      this.prismaService,
      email,
      dto.otp,
      otpSecret,
    );

    return {
      success: true,
      message: "Password reset code verified.",
    };
  }

  async resetPassword(
    dto: ForgotPasswordResetDto,
  ): Promise<PasswordResetResponse> {
    const email = this.normalizeEmail(dto.email);
    const otpSecret = this.getJwtSecret();
    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      PASSWORD_HASH_ROUNDS,
    );

    await this.prismaService.$transaction(async (tx) => {
      const otpRecord = await this.getValidPasswordResetOtp(
        tx,
        email,
        dto.otp,
        otpSecret,
      );
      const usedAt = new Date();
      const markUsedResult = await tx.passwordResetOtp.updateMany({
        where: {
          id: otpRecord.id,
          usedAt: null,
        },
        data: {
          usedAt,
        },
      });

      if (markUsedResult.count !== 1) {
        throw this.invalidPasswordResetOtpException();
      }

      await tx.user.update({
        where: { id: otpRecord.userId },
        data: {
          passwordHash,
          refreshTokenHash: null,
          refreshTokenExpiresAt: null,
        },
      });
    });

    return {
      success: true,
      message: "Password has been reset.",
    };
  }

  private async issueTokens(
    user: PublicUserRecord,
    previousRefreshTokenHash?: string,
  ): Promise<AuthTokenResponse> {
    const jwtSecret = this.getJwtSecret();
    const refreshToken = this.createRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    if (previousRefreshTokenHash) {
      const updateResult = await this.prismaService.user.updateMany({
        where: {
          id: user.id,
          refreshTokenHash: previousRefreshTokenHash,
        },
        data: {
          refreshTokenHash,
          refreshTokenExpiresAt,
        },
      });

      if (updateResult.count !== 1) {
        throw new UnauthorizedException({
          code: "REFRESH_TOKEN_INVALID",
          message: "Refresh token is invalid or expired.",
        });
      }
    } else {
      await this.prismaService.user.update({
        where: { id: user.id },
        data: {
          refreshTokenHash,
          refreshTokenExpiresAt,
        },
      });
    }

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "access",
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: this.accessTokenExpiresIn,
    });

    return {
      user: this.mapPublicUser(user),
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.accessTokenExpiresIn,
    };
  }

  private mapPublicUser(user: PublicUserRecord): PublicUserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeOptionalText(
    value: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private createRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  private createOAuthState(): string {
    return randomBytes(OAUTH_STATE_BYTES).toString("base64url");
  }

  private createPasswordResetOtp(): string {
    return randomInt(0, 10 ** PASSWORD_RESET_OTP_DIGITS)
      .toString()
      .padStart(PASSWORD_RESET_OTP_DIGITS, "0");
  }

  private hashPasswordResetOtp(
    email: string,
    otp: string,
    otpSecret: string,
  ): string {
    return createHmac("sha256", otpSecret)
      .update(`${email}:${otp}`)
      .digest("hex");
  }

  private getJwtSecret(): string {
    const jwtSecret = this.configService.get<string>("JWT_SECRET")?.trim();

    if (!jwtSecret) {
      throw new InternalServerErrorException({
        code: "AUTH_CONFIGURATION_ERROR",
        message: "Authentication is not configured.",
      });
    }

    return jwtSecret;
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new InternalServerErrorException({
        code: "AUTH_CONFIGURATION_ERROR",
        message: "Authentication is not configured.",
      });
    }

    return value;
  }

  private async createCustomerUser(
    dto: RegisterDto,
    email: string,
    passwordHash: string,
  ): Promise<PublicUserRecord> {
    try {
      return await this.prismaService.user.create({
        data: {
          email,
          passwordHash,
          name: this.normalizeOptionalText(dto.name),
          phone: this.normalizeOptionalText(dto.phone),
          role: UserRoleValue.CUSTOMER,
          authProvider: AuthProvider.EMAIL,
        },
        select: publicUserSelect,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw this.emailAlreadyRegisteredException();
      }

      throw error;
    }
  }

  private async exchangeGoogleCodeForIdToken(code: string): Promise<string> {
    const body = new URLSearchParams({
      code,
      client_id: this.getRequiredConfig("GOOGLE_CLIENT_ID"),
      client_secret: this.getRequiredConfig("GOOGLE_CLIENT_SECRET"),
      redirect_uri: this.getRequiredConfig("GOOGLE_CALLBACK_URL"),
      grant_type: "authorization_code",
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw this.googleOAuthException();
    }

    const tokenResponse = (await response.json()) as GoogleTokenResponse;

    if (!tokenResponse.id_token) {
      throw this.googleOAuthException();
    }

    return tokenResponse.id_token;
  }

  private async getVerifiedGoogleProfile(
    idToken: string,
  ): Promise<GoogleProfile> {
    const tokenInfoUrl = new URL(GOOGLE_TOKEN_INFO_URL);
    tokenInfoUrl.searchParams.set("id_token", idToken);

    const response = await fetch(tokenInfoUrl);

    if (!response.ok) {
      throw this.googleOAuthException();
    }

    const tokenInfo = (await response.json()) as GoogleTokenInfoResponse;
    const clientId = this.getRequiredConfig("GOOGLE_CLIENT_ID");
    const emailVerified =
      tokenInfo.email_verified === true || tokenInfo.email_verified === "true";
    const expiresAt = tokenInfo.exp ? Number(tokenInfo.exp) * 1000 : 0;

    if (
      tokenInfo.aud !== clientId ||
      !tokenInfo.sub ||
      !tokenInfo.email ||
      !emailVerified ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      throw this.googleOAuthException();
    }

    return {
      id: tokenInfo.sub,
      email: this.normalizeEmail(tokenInfo.email),
      emailVerified,
      name: this.normalizeOptionalText(tokenInfo.name) ?? undefined,
    };
  }

  private async findOrCreateGoogleUser(
    profile: GoogleProfile,
  ): Promise<PublicUserRecord> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const existingGoogleUser = await tx.user.findUnique({
          where: { googleId: profile.id },
          select: googleLinkedUserSelect,
        });

        if (existingGoogleUser) {
          return this.mapGoogleLinkedUser(existingGoogleUser);
        }

        const existingEmailUser = await tx.user.findUnique({
          where: { email: profile.email },
          select: googleLinkedUserSelect,
        });

        if (existingEmailUser) {
          if (
            existingEmailUser.googleId &&
            existingEmailUser.googleId !== profile.id
          ) {
            throw this.googleOAuthException();
          }

          const updateData: Prisma.UserUpdateInput = {
            googleId: profile.id,
            emailVerified: true,
          };

          if (!existingEmailUser.name && profile.name) {
            updateData.name = profile.name;
          }

          const updatedUser = await tx.user.update({
            where: { id: existingEmailUser.id },
            data: updateData,
            select: publicUserSelect,
          });

          return updatedUser;
        }

        return await tx.user.create({
          data: {
            email: profile.email,
            passwordHash: null,
            name: profile.name,
            role: UserRoleValue.CUSTOMER,
            authProvider: AuthProvider.GOOGLE,
            googleId: profile.id,
            emailVerified: true,
          },
          select: publicUserSelect,
        });
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw this.googleOAuthException();
      }

      throw error;
    }
  }

  private mapGoogleLinkedUser(user: GoogleLinkedUserRecord): PublicUserRecord {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async getValidPasswordResetOtp(
    client: PasswordResetClient,
    email: string,
    otp: string,
    otpSecret: string,
  ): Promise<PasswordResetOtpRecord> {
    const latestOtp = await client.passwordResetOtp.findFirst({
      where: {
        email,
        usedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: passwordResetOtpSelect,
    });

    if (!latestOtp || latestOtp.expiresAt.getTime() <= Date.now()) {
      throw this.invalidPasswordResetOtpException();
    }

    if (latestOtp.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      throw this.invalidPasswordResetOtpException();
    }

    const candidateHash = this.hashPasswordResetOtp(email, otp, otpSecret);

    if (!this.isHashMatch(candidateHash, latestOtp.otpHash)) {
      await client.passwordResetOtp.update({
        where: { id: latestOtp.id },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      throw this.invalidPasswordResetOtpException();
    }

    return latestOtp;
  }

  private isHashMatch(candidateHash: string, storedHash: string): boolean {
    const candidateBuffer = Buffer.from(candidateHash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    if (candidateBuffer.length !== storedBuffer.length) {
      return false;
    }

    return timingSafeEqual(candidateBuffer, storedBuffer);
  }

  private buildRedirectUrl(baseUrl: string, params: Record<string, string>) {
    const redirectUrl = new URL(baseUrl);

    for (const [key, value] of Object.entries(params)) {
      redirectUrl.searchParams.set(key, value);
    }

    return redirectUrl.toString();
  }

  private parseExpiresInSeconds(value: JwtSignOptions["expiresIn"]): number {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }

    if (typeof value !== "string") {
      return DEFAULT_ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS;
    }

    const match = value.trim().match(/^(\d+)([smhd])?$/);

    if (!match) {
      return DEFAULT_ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS;
    }

    const amount = Number(match[1]);
    const unit = match[2] ?? "s";
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };

    return amount * multipliers[unit];
  }

  private passwordResetRequestResponse(): PasswordResetResponse {
    return {
      success: true,
      message: passwordResetRequestMessage,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private emailAlreadyRegisteredException(): ConflictException {
    return new ConflictException({
      code: "EMAIL_ALREADY_REGISTERED",
      message: "An account with this email already exists.",
    });
  }

  private googleOAuthException(): UnauthorizedException {
    return new UnauthorizedException({
      code: "GOOGLE_OAUTH_FAILED",
      message: "Google login could not be completed.",
    });
  }

  private invalidPasswordResetOtpException(): UnauthorizedException {
    return new UnauthorizedException({
      code: "PASSWORD_RESET_OTP_INVALID",
      message: "Password reset code is invalid or expired.",
    });
  }
}
