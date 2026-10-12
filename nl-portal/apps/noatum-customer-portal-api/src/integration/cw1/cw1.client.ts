import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { XmlCodec } from './xml.codec';

/**
 * Transport for CW1. Owns credentials, timeouts and retries; knows nothing about
 * shipments or rates.
 *
 * Retries are limited to idempotent reads. A POST that may have created something in
 * CW1 is never retried automatically - that is a job with an explicit dedupe key.
 */
@Injectable()
export class Cw1Client {
  private readonly logger = new Logger(Cw1Client.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly xml: XmlCodec,
  ) {}

  async post(url: string, xmlBody: string, { retries = 0 } = {}): Promise<string> {
    const username = this.config.getOrThrow<string>('cw1.username');
    const password = this.config.getOrThrow<string>('cw1.password');
    const timeout = this.config.get<number>('cw1.timeoutMs') ?? 15_000;

    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await firstValueFrom(
          this.http.post<string>(url, xmlBody, {
            timeout,
            responseType: 'text',
            headers: { 'Content-Type': 'application/xml; charset=utf-8' },
            auth: { username, password },
          }),
        );
        return response.data;
      } catch (error) {
        lastError = error;
        // Never log the body: it carries customer data, and the headers carry credentials.
        this.logger.warn(
          { url, attempt, err: error instanceof Error ? error.message : 'unknown' },
          'CW1 request failed',
        );
      }
    }

    throw new ServiceUnavailableException(
      `CargoWise did not respond successfully after ${retries + 1} attempt(s).`,
      { cause: lastError },
    );
  }

  /** Convenience for the read paths: post XML, get a parsed document back. */
  async exchange<T>(url: string, xmlBody: string, options?: { retries?: number }): Promise<T> {
    return this.xml.parse<T>(await this.post(url, xmlBody, options));
  }
}
