import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createTransport,
  type SendMailOptions,
  type SentMessageInfo,
  type Transporter,
} from 'nodemailer';

const EMAIL_PROVIDER_RESEND = 'resend';
const SMTP_PROVIDER = 'smtp';
const SMTP_SECURE_PORT = 465;
const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

type EmailProvider = typeof SMTP_PROVIDER | typeof EMAIL_PROVIDER_RESEND;
type EmailType = 'PASSWORD_RESET_OTP' | 'TRANSACTIONAL';

interface TransactionalEmailOptions {
  html?: string;
  subject: string;
  text: string;
  to: string;
}

export interface EmailReadiness {
  configured: boolean;
  emailFromPresent: boolean;
  emailProvider: string;
  emailProviderPresent: boolean;
  emailProviderReady: boolean;
  emailProviderSupported: boolean;
  resendApiKeyPresent: boolean;
  smtpAuthConfigured: boolean;
  smtpConfigured: boolean;
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
  private readonly activeProvider: EmailProvider | null;
  private readonly apiKey?: string;
  private readonly transporter?: Transporter;
  private readonly from?: string;
  private readonly readiness: EmailReadiness;

  constructor(private readonly configService: ConfigService) {
    const provider = this.getConfigValue('EMAIL_PROVIDER')?.toLowerCase();
    const activeProvider = this.toSupportedProvider(provider);
    const host = this.getConfigValue('SMTP_HOST');
    const rawPort = this.getConfigValue('SMTP_PORT');
    const port = this.parseSmtpPort(rawPort);
    const emailFrom = this.getConfigValue('EMAIL_FROM');
    const smtpFrom = this.getConfigValue('SMTP_FROM');
    const from = emailFrom ?? smtpFrom;
    const user = this.getConfigValue('SMTP_USER');
    const pass = this.getConfigValue('SMTP_PASS');
    const resendApiKey = this.getConfigValue('RESEND_API_KEY');
    const providerSupported = Boolean(activeProvider);
    const readinessProvider =
      activeProvider ?? (provider ? 'unsupported' : SMTP_PROVIDER);
    const smtpConfigured = Boolean(host && port && from);
    const resendConfigured = Boolean(resendApiKey && from);
    const emailProviderReady =
      activeProvider === SMTP_PROVIDER
        ? smtpConfigured
        : activeProvider === EMAIL_PROVIDER_RESEND
          ? resendConfigured
          : false;

    this.activeProvider = activeProvider;
    this.readiness = {
      configured: emailProviderReady,
      emailFromPresent: Boolean(from),
      emailProvider: readinessProvider,
      emailProviderPresent: Boolean(provider),
      emailProviderReady,
      emailProviderSupported: providerSupported,
      resendApiKeyPresent: Boolean(resendApiKey),
      smtpAuthConfigured: Boolean(user && pass),
      smtpConfigured,
      smtpFromPresent: Boolean(smtpFrom),
      smtpHostPresent: Boolean(host),
      smtpPassPresent: Boolean(pass),
      smtpPortPresent: Boolean(rawPort),
      smtpPortValid: Boolean(port),
      smtpUserPresent: Boolean(user),
    };

    if (!activeProvider) {
      this.logger.warn('Email provider is not supported by this backend.');
      return;
    }

    this.from = from;

    if (activeProvider === EMAIL_PROVIDER_RESEND) {
      this.apiKey = resendApiKey;
      return;
    }

    if (!host || !port || !from) {
      return;
    }

    this.transporter = createTransport({
      host,
      port,
      secure: port === SMTP_SECURE_PORT,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  isConfigured(): boolean {
    return this.readiness.emailProviderReady;
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
      'Transactional email was not sent because email provider delivery is not configured.',
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
      'Password reset email was not sent because email provider delivery is not configured.',
      'Password reset email could not be sent.',
      'PASSWORD_RESET_OTP',
    );
  }

  private async sendMail(
    options: TransactionalEmailOptions,
    notConfiguredMessage: string,
    failedMessage: string,
    emailType: EmailType,
  ): Promise<boolean> {
    if (!this.activeProvider || !this.from || !this.isConfigured()) {
      this.log('warn', 'EMAIL_PROVIDER_NOT_CONFIGURED', {
        emailType,
        provider: this.readiness.emailProvider,
        readiness: this.getReadiness(),
      });
      this.logger.warn(notConfiguredMessage);
      return false;
    }

    if (this.activeProvider === EMAIL_PROVIDER_RESEND) {
      return this.sendResendMail(options, failedMessage, emailType);
    }

    return this.sendSmtpMail(options, failedMessage, emailType);
  }

  private async sendSmtpMail(
    options: TransactionalEmailOptions,
    failedMessage: string,
    emailType: EmailType,
  ): Promise<boolean> {
    if (!this.transporter || !this.from) {
      this.log('warn', 'EMAIL_PROVIDER_NOT_CONFIGURED', {
        emailType,
        provider: SMTP_PROVIDER,
        readiness: this.getReadiness(),
      });
      return false;
    }

    try {
      const info = (await this.transporter.sendMail({
        from: this.from,
        ...(options as Omit<SendMailOptions, 'from'>),
      })) as SentMessageInfo;

      this.log('log', 'EMAIL_SEND_ACCEPTED', {
        emailType,
        provider: SMTP_PROVIDER,
        providerAccepted: true,
        providerMessageIdPresent: this.hasProviderMessageId(info),
      });
      return true;
    } catch (error) {
      this.log('warn', 'EMAIL_SEND_FAILED', {
        emailType,
        provider: SMTP_PROVIDER,
        error: this.toSafeSmtpErrorSummary(error),
        providerAccepted: false,
      });
      this.logger.warn(failedMessage);
      return false;
    }
  }

  private async sendResendMail(
    options: TransactionalEmailOptions,
    failedMessage: string,
    emailType: EmailType,
  ): Promise<boolean> {
    if (!this.apiKey || !this.from) {
      this.log('warn', 'EMAIL_PROVIDER_NOT_CONFIGURED', {
        emailType,
        provider: EMAIL_PROVIDER_RESEND,
        readiness: this.getReadiness(),
      });
      return false;
    }

    try {
      const response = await fetch(RESEND_EMAILS_URL, {
        body: JSON.stringify({
          from: this.from,
          to: [options.to],
          subject: options.subject,
          text: options.text,
          ...(options.html ? { html: options.html } : {}),
        }),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        this.log('warn', 'EMAIL_SEND_FAILED', {
          emailType,
          provider: EMAIL_PROVIDER_RESEND,
          error: {
            name: 'ResendApiError',
            statusCode: response.status,
            safeMessageSummary:
              'Resend API did not accept the message for delivery.',
          },
          providerAccepted: false,
        });
        this.logger.warn(failedMessage);
        return false;
      }

      const responseBody = await this.parseJsonResponse(response);
      this.log('log', 'EMAIL_SEND_ACCEPTED', {
        emailType,
        provider: EMAIL_PROVIDER_RESEND,
        providerAccepted: true,
        providerMessageIdPresent:
          this.getStringField(responseBody, 'id') !== undefined,
      });

      return true;
    } catch (error) {
      this.log('warn', 'EMAIL_SEND_FAILED', {
        emailType,
        provider: EMAIL_PROVIDER_RESEND,
        error: this.toSafeResendErrorSummary(error),
        providerAccepted: false,
      });
      this.logger.warn(failedMessage);
      return false;
    }
  }

  private getConfigValue(key: string): string | undefined {
    const value = this.configService.get<string>(key)?.trim();

    return value ? value : undefined;
  }

  private toSupportedProvider(provider: string | undefined): EmailProvider | null {
    if (!provider || provider === SMTP_PROVIDER) {
      return SMTP_PROVIDER;
    }

    if (provider === EMAIL_PROVIDER_RESEND) {
      return EMAIL_PROVIDER_RESEND;
    }

    return null;
  }

  private parseSmtpPort(rawPort: string | undefined): number | undefined {
    if (!rawPort) {
      return undefined;
    }

    const port = Number(rawPort);

    return Number.isInteger(port) && port > 0 ? port : undefined;
  }

  private async parseJsonResponse(response: Response): Promise<unknown> {
    try {
      return (await response.json()) as unknown;
    } catch {
      return undefined;
    }
  }

  private hasProviderMessageId(info: unknown): boolean {
    return this.getStringField(info, 'messageId') !== undefined;
  }

  private getStringField(
    value: unknown,
    key: string,
  ): string | undefined {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const field = value[key];

    return typeof field === 'string' && field.trim() ? field : undefined;
  }

  private toSafeSmtpErrorSummary(error: unknown) {
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

  private toSafeResendErrorSummary(error: unknown) {
    const record = this.isRecord(error) ? error : {};
    const code = typeof record.code === 'string' ? record.code : undefined;

    return {
      code,
      name: error instanceof Error ? error.name : 'UnknownError',
      safeMessageSummary:
        'Resend API send failed before the provider accepted the message.',
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
