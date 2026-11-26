/**
 * OpenAI (REST, no SDK): one structured-output call shared by invoice extraction and sales request reading.
 * Images and PDFs are sent inline; the answer is constrained to the zod schema (strict JSON schema).
 */
import { z } from 'zod';
import { recordAiUsage, type AiFeature } from './aiUsage.ts';
import { config } from './config.ts';

export interface OpenAiFile {
  mediaType: string;
  base64: string;
  name?: string;
}

interface Output {
  type: string;
  content?: { type: string; text?: string; refusal?: string }[];
}

/** Returns the parsed answer, or undefined when the call failed, was refused, or did not match the schema. */
export async function openaiStructured<S extends z.ZodType>(opts: {
  schema: S;
  /** Letters, digits, underscore or dash (OpenAI requirement). */
  name: string;
  system?: string;
  text: string;
  files?: OpenAiFile[];
  tag: string;
  feature: AiFeature;
}): Promise<z.infer<S> | undefined> {
  try {
    const { $schema: _s, ...schema } = z.toJSONSchema(opts.schema) as Record<string, unknown>;
    const content: Record<string, unknown>[] = [];
    for (const f of opts.files ?? []) {
      const dataUrl = `data:${f.mediaType};base64,${f.base64}`;
      content.push(f.mediaType === 'application/pdf' ? { type: 'input_file', filename: f.name || 'document.pdf', file_data: dataUrl } : { type: 'input_image', image_url: dataUrl });
    }
    content.push({ type: 'input_text', text: opts.text });
    const res = await fetch(`${config.ai.openaiBaseUrl}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.openaiKey}` },
      body: JSON.stringify({
        model: config.ai.model,
        store: false,
        ...(opts.system ? { instructions: opts.system } : {}),
        input: [{ role: 'user', content }],
        text: { format: { type: 'json_schema', name: opts.name, strict: true, schema } },
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[${opts.tag}] OpenAI error ${res.status}: ${body.slice(0, 300)}`);
      return undefined;
    }
    const json = JSON.parse(body) as { output?: Output[]; usage?: { input_tokens?: number; output_tokens?: number } };
    await recordAiUsage(opts.feature, json.usage?.input_tokens, json.usage?.output_tokens);
    const out = json.output ?? [];
    const parts = out.filter((o) => o.type === 'message').flatMap((o) => o.content ?? []);
    if (parts.some((p) => p.type === 'refusal')) {
      console.warn(`[${opts.tag}] OpenAI refused the request`);
      return undefined;
    }
    const text = parts.find((p) => p.type === 'output_text')?.text;
    const parsed = opts.schema.safeParse(text ? JSON.parse(text) : undefined);
    if (!parsed.success) {
      console.warn(`[${opts.tag}] OpenAI returned no valid result`);
      return undefined;
    }
    return parsed.data;
  } catch (e) {
    console.error(`[${opts.tag}] OpenAI failed`, e);
    return undefined;
  }
}
