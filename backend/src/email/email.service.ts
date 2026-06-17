import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createTransport,
  type SendMailOptions,
  type Transporter,
} from 'nodemailer';

const SMTP_PROVIDER = 'smtp';
const SMTP_SECURE_PORT = 465;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter?: Transporter;
  private readonly from?: string;

  constructor(private readonly configService: ConfigService) {
    const provider = this.getConfigValue('EMAIL_PROVIDER')?.toLowerCase();
    const host = this.getConfigValue('SMTP_HOST');
    const port = this.getSmtpPort();
    const from = this.getConfigValue('SMTP_FROM');

    if (provider && provider !== SMTP_PROVIDER) {
      this.logger.warn('Email provider is not supported by this backend.');
      return;
    }

    if (!host || !port || !from) {
      return;
    }

    const user = this.getConfigValue('SMTP_USER');
    const pass = this.getConfigValue('SMTP_PASS');

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
    );
  }

  private async sendMail(
    options: Omit<SendMailOptions, 'from'>,
    notConfiguredMessage: string,
    failedMessage: string,
  ): Promise<boolean> {
    if (!this.transporter || !this.from) {
      this.logger.warn(notConfiguredMessage);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        ...options,
      });

      return true;
    } catch {
      this.logger.warn(failedMessage);
      return false;
    }
  }

  private getConfigValue(key: string): string | undefined {
    const value = this.configService.get<string>(key)?.trim();

    return value ? value : undefined;
  }

  private getSmtpPort(): number | undefined {
    const rawPort = this.getConfigValue('SMTP_PORT');

    if (!rawPort) {
      return undefined;
    }

    const port = Number(rawPort);

    return Number.isInteger(port) && port > 0 ? port : undefined;
  }
}
