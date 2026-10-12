import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Exact cost parameters are still LA-02; these are the library's own defaults. */
const HASH_OPTIONS: argon2.HashOptions = { type: argon2.argon2id };

@Injectable()
export class PasswordService implements OnModuleInit {
  /** A real hash of a throwaway value, so an unknown email costs what a known one costs. */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(randomFiller(), HASH_OPTIONS);
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // A malformed stored hash is a failed sign-in, never a 500 that confirms the account.
      return false;
    }
  }

  /**
   * Burn the same work when there is nothing to verify against. Without it, "no such
   * account" answers in a millisecond and a real account takes ~50ms, which is enough
   * to enumerate customers.
   */
  async verifyDummy(): Promise<false> {
    if (this.dummyHash) await argon2.verify(this.dummyHash, randomFiller()).catch(() => false);
    return false;
  }

  /** True when a hash predates the current cost settings and should be replaced on next login. */
  needsRehash(hash: string): boolean {
    try {
      // Cost options only: argon2 compares them against the digest's own parameters.
      return argon2.needsRehash(hash);
    } catch {
      return false;
    }
  }
}

function randomFiller(): string {
  return `dummy-${Math.random().toString(36).slice(2)}`;
}
