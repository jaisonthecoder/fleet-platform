import { authenticatedClient } from '../../auth/api/current-user';

export interface IntakeQuestion {
  id: string;
  field: string;
  ask: string;
}

export interface IntakeDraft {
  status: 'extracted' | 'not-configured' | 'unreadable';
  detail?: string;
  provenance: { provider?: string; model?: string; extractedAt?: string };
  fields: Record<string, unknown>;
  derived: { rule: string; text: string }[];
  questions: IntakeQuestion[];
}

export interface IntakeInput {
  text?: string;
  file?: { mimeType: string; dataBase64: string };
  locale?: string;
}

/** Demo endpoint. Typed from the generated document like every other call. */
export async function requestIntakeDraft(input: IntakeInput): Promise<IntakeDraft> {
  const client = await authenticatedClient('customer');

  const response = await client.POST('/api/ai/quote-intake', { body: input });

  if (response.error) {
    throw new Error('intake-failed');
  }

  return response.data as IntakeDraft;
}

/** Strips the data URL prefix the FileReader adds, which the API does not want. */
export function readFileAsBase64(file: File): Promise<{ mimeType: string; dataBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve({ mimeType: file.type, dataBase64: comma >= 0 ? result.slice(comma + 1) : result });
    };
    reader.readAsDataURL(file);
  });
}
