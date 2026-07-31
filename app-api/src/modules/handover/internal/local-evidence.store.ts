import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { HandoverEvidenceStore } from './evidence-store.port';

/** Local private evidence adapter used only by local, development and test environments. */
@Injectable()
export class LocalHandoverEvidenceStore implements HandoverEvidenceStore {
  constructor(private readonly config: ConfigService) {}

  /** Durably writes one private object and refuses production use. */
  async put(objectKey: string, body: Buffer): Promise<void> {
    const path = this.objectPath(objectKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: 'wx', mode: 0o600 });
  }

  /** Deletes one unclaimed local object; missing files are already clean. */
  async delete(objectKey: string): Promise<void> {
    await rm(this.objectPath(objectKey), { force: true });
  }

  /** Resolves a generated object key beneath the configured private root. */
  private objectPath(objectKey: string): string {
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'local';
    if (!['local', 'development', 'test'].includes(nodeEnv)) {
      throw new Error('local Handover evidence store is disabled outside development environments');
    }
    const configured = this.config.get<string>('HANDOVER_EVIDENCE_LOCAL_DIR') ?? '.local/handover-evidence';
    const root = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
    const target = resolve(root, objectKey);
    const fromRoot = relative(root, target);
    if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) throw new Error('invalid Handover evidence object key');
    return target;
  }
}
