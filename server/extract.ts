/**
 * Invoice extraction: sends the PDF to an AI model (Claude, or Google Gemini) and gets back the fields
 * Imago needs, validated against a schema. Enabled only when the chosen provider's API key is set.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { ExtractedInvoice } from '../src/modules/accounting/types.ts';
import { config } from './config.ts';

const InvoiceSchema = z.object({
  vendorName: z.string(),
  vendorEmail: z.string(),
  invoiceNo: z.string(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  poNo: z.string(),
  currency: z.string(),
  lines: z.array(
    z.object({
      itemNo: z.string(),
      description: z.string(),
      uom: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
    }),
  ),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
});

const PROMPT = `This PDF is a vendor invoice received by Pubco, a Canadian packaging company.
Extract the invoice fields.
- Dates as YYYY-MM-DD. If the due date is missing, compute it from the payment terms; if there are no terms, use the invoice date.
- poNo is Pubco's purchase order number as printed on the invoice (often labelled PO, P.O., Bon de commande, Votre commande). Empty string if absent.
- itemNo is Pubco's item number when printed, otherwise the vendor's item or product code.
- currency is the ISO code (CAD, USD, EUR...).
- tax is the sum of all sales taxes (GST/TPS, QST/TVQ, HST...).
- Use an empty string for any text field that is not on the document. Never invent values.`;

let client: Anthropic | undefined;

export async function extractInvoice(pdf: Buffer, fromEmail: string): Promise<ExtractedInvoice | undefined> {
  if (!config.ai.enabled) return undefined;
  const out = config.ai.provider === 'gemini' ? await extractWithGemini(pdf) : await extractWithClaude(pdf);
  return out ? { ...out, vendorEmail: out.vendorEmail || fromEmail } : undefined;
}

/** Google Gemini (REST, no SDK): the PDF is sent inline and the answer is constrained to the JSON schema. */
async function extractWithGemini(pdf: Buffer): Promise<z.infer<typeof InvoiceSchema> | undefined> {
  try {
    const { $schema: _s, ...schema } = z.toJSONSchema(InvoiceSchema) as Record<string, unknown>;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.ai.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.ai.geminiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0 },
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[extract] Gemini error ${res.status}: ${body.slice(0, 300)}`);
      return undefined;
    }
    const text = (JSON.parse(body) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = InvoiceSchema.safeParse(text ? JSON.parse(text) : undefined);
    if (!parsed.success) {
      console.warn('[extract] Gemini returned no valid result');
      return undefined;
    }
    return parsed.data;
  } catch (e) {
    console.error('[extract] Gemini failed', e);
    return undefined;
  }
}

async function extractWithClaude(pdf: Buffer): Promise<z.infer<typeof InvoiceSchema> | undefined> {
  client ??= new Anthropic();
  try {
    const response = await client.messages.parse({
      model: config.ai.model,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: zodOutputFormat(InvoiceSchema) },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      console.warn(`[extract] no result (stop_reason=${response.stop_reason})`);
      return undefined;
    }
    return response.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error(`[extract] API error ${e.status}: ${e.message}`);
    else console.error('[extract] failed', e);
    return undefined;
  }
}
