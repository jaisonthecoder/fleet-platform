import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { TenantContext } from './tenant-context';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly context: TenantContext) {}

  use(_request: Request, _response: Response, next: NextFunction): void {
    this.context.runRequest(next);
  }
}
