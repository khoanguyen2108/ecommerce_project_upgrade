import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createTransport,
  type SendMailOptions,
  type Transporter,
} from 'nodemailer';

const SMTP_PROVIDER = 'smtp';
const SMTP_SECURE_PORT = 465;

export interface EmailReadiness {
  configured: boolean;
  emailProvider: string;
  emailProviderPresent: boolean;
  emailProviderSupported: boolean;
  smtpAuthConfigured: boolean;
  smtpFromPresent: boolean;
  smtpHostPresent: boolean;
  smtpPassPresent: boolean;
  smtpPortPresent: boolean;
  smtpPortValid: boolean;
  smtpUserPresent: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter?: Transporter;
  private readonly from?: string;
  private readonly readiness: EmailReadiness;

  constructor(private readonly configService: ConfigService) {
    const provider = this.getConfigValue('EMAIL_PROVIDER')?.toLowerCase();
    const host = this.getConfigValue('SMTP_HOST');
    const rawPort = this.getConfigValue('SMTP_PORT');
    const port = this.parseSmtpPort(rawPort);
    const from = this.getConfigValue('SMTP_FROM');
    const user = this.getConfigValue('SMTP_USER');
    const pass = this.getConfigValue('SMTP_PASS');
    const providerSupported = !provider || provider === SMTP_PROVIDER;

    this.readiness = {
      configured: Boolean(providerSupported && host && port && from),
      emailProvider: provider || SMTP_PROVIDER,
      emailProviderPresent: Boolean(provider),
      emailProviderSupported: providerSupported,
      smtpAuthConfigured: Boolean(user && pass),
      smtpFromPresent: Boolean(from),
      smtpHostPresent: Boolean(host),
      smtpPassPresent: Boolean(pass),
      smtpPortPresent: Boolean(rawPort),
      smtpPortValid: Boolean(port),
      smtpUserPresent: Boolean(user),
    };

    if (!providerSupported) {
      this.logger.warn('Email provider is not supported by this backend.');
      return;
    }

    if (!host || !port || !from) {
      return;
    }

    this.from = from;
    this.transporter = createTransport({
      host,
      port,
      secure: port === SMTP_SECURE_PORT,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  isConfigured(): boolean {
    return Boolean(this.transporter && this.from);
  }

  getReadiness(): EmailReadiness {
    return {
      ...this.readiness,
      configured: this.isConfigured(),
    };
  }

  async sendTransactionalEmail(options: {
    html?: string;
    subject: string;
    text: string;
    to: string;
  }): Promise<boolean> {
    return this.sendMail(
      options,
      'Transactional email was not sent because SMTP email is not configured.',
      'Transactional email could not be sent.',
      'TRANSACTIONAL',
    );
  }

  async sendPasswordResetOtp(to: string, otp: string): Promise<boolean> {
    return this.sendMail(
      {
        to,
        subject: 'Your password reset OTP',
        text: [
          `Your password reset OTP is ${otp}.`,
          'This code expires in 1 minute.',
          'Do not share this code.',
          'If you did not request it, ignore this email.',
        ].join('\n'),
      },
      'Password reset email was not sent because SMTP email is not configured.',
      'Password reset email could not be sent.',
      'PASSWORD_RESET_OTP',
    );
  }

  private async sendMail(
    options: Omit<SendMailOptions, 'from'>,
    notConfiguredMessage: string,
    failedMessage: string,
    emailType: 'PASSWORD_RESET_OTP' | 'TRANSACTIONAL',
  ): Promise<boolean> {
    if (!this.transporter || !this.from) {
      this.log('warn', 'SMTP_NOT_CONFIGURED', {
        emailType,
        readiness: this.getReadiness(),
      });
      this.logger.warn(notConfiguredMessage);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        ...options,
      });

      return true;
    } catch (error) {
      this.log('warn', 'EMAIL_SEND_FAILED', {
        emailType,
        error: this.toSafeEmailErrorSummary(error),
      });
      this.logger.warn(failedMessage);
      return false;
    }
  }

  private getConfigValue(key: string): string | undefined {
    const value = this.configService.get<string>(key)?.trim();

    return value ? value : undefined;
  }

  private parseSmtpPort(rawPort: string | undefined): number | undefined {
    if (!rawPort) {
      return undefined;
    }

    const port = Number(rawPort);

    return Number.isInteger(port) && port > 0 ? port : undefined;
  }

  private toSafeEmailErrorSummary(error: unknown) {
    const record = this.isRecord(error) ? error : {};
    const code = typeof record.code === 'string' ? record.code : undefined;
    const command =
      typeof record.command === 'string' ? record.command : undefined;
    const responseCode =
      typeof record.responseCode === 'number'
        ? record.responseCode
        : undefined;

    return {
      code,
      command,
      name: error instanceof Error ? error.name : 'UnknownError',
      responseCode,
      safeMessageSummary:
        'SMTP send failed before the provider accepted the message.',
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private log(
    level: 'log' | 'warn',
    code: string,
    data: Record<string, unknown>,
  ) {
    const message = JSON.stringify({
      code,
      ...data,
    });

    if (level === 'log') {
      this.logger.log(message);
      return;
    }

    this.logger.warn(message);
  }
}
