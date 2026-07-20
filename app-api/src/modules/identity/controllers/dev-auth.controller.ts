import {
  Controller,
  Get,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Public } from '../../../common/auth/auth.decorators';
import { identityConfig } from '../../../common/config/identity.config';
import { IdentityRepository } from '../repositories/identity.repository';

interface DevUser {
  personId: string;
  fullName: string;
  email: string | null;
  grade: string | null;
  roles: { role: string; scopeName: string | null }[];
}

/**
 * Dev-login support. Exposes the seeded users (name, email, roles) so the login
 * screen can offer a one-click picker instead of a raw person id. Public and
 * available **only where dev-login is enabled** — it returns 404 in uat/
 * production so real user data never leaks (mirrors P0-R2-4).
 */
@Controller({ path: 'dev', version: '1' })
export class DevAuthController {
  constructor(
    private readonly repo: IdentityRepository,
    @Inject(identityConfig.KEY)
    private readonly config: ConfigType<typeof identityConfig>,
  ) {}

  @Public()
  @Get('users')
  async listDevUsers(): Promise<DevUser[]> {
    if (!this.config.devLoginEnabled) {
      throw new NotFoundException({
        title: 'Not found',
        reasons: ['dev-login-disabled'],
      });
    }

    const rows = await this.repo.listPeopleWithRoles();
    const byPerson = new Map<string, DevUser>();
    for (const row of rows) {
      let user = byPerson.get(row.personId);
      if (!user) {
        user = {
          personId: row.personId,
          fullName: row.fullName,
          email: row.email,
          grade: row.grade,
          roles: [],
        };
        byPerson.set(row.personId, user);
      }
      if (row.role) {
        user.roles.push({ role: row.role, scopeName: row.scopeName ?? null });
      }
    }
    return [...byPerson.values()];
  }
}
