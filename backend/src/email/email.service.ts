import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

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

  async sendPasswordResetOtp(to: string, otp: string): Promise<boolean> {
    if (!this.transporter || !this.from) {
      this.logger.warn(
        'Password reset email was not sent because SMTP email is not configured.',
      );
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Your password reset OTP',
        text: [
          `Your password reset OTP is ${otp}.`,
          'This code expires in 1 minute.',
          'Do not share this code.',
          'If you did not request it, ignore this email.',
        ].join('\n'),
      });

      return true;
    } catch {
      this.logger.warn('Password reset email could not be sent.');
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
