/**
 * Photo analysis for estimates. The server reads the photo and proposes packaging values.
 * Nothing is applied without the estimator's confirmation (see EstimateEditor).
 * Only available with the Imago API (API_MODE); in dev mode the editor disables these actions.
 */
import { api } from '@/data/db';
import { uploadFile } from '@/modules/sales/stores';
import type { PackagingSpec } from './types';

export interface ImageSuggestion {
  suggested: Partial<PackagingSpec>;
  summary: string;
  assumptions: string[];
}

/** Uploads an image or PDF to the shared file store (in dev mode, kept in this browser). Returns the file id. */
export const uploadEstimateFile = (file: File): Promise<string> => uploadFile(file);

/**
 * Asks the server to analyse an uploaded photo for an estimate.
 * Route: POST /api/estimating/analyze-image  body {estimateId, fileId}
 * response: {suggested: Partial<PackagingSpec>, summary: string, assumptions: string[]}
 */
export async function analyzeEstimateImage(estimateId: string, fileId: string): Promise<ImageSuggestion> {
  const res = await api<Partial<ImageSuggestion>>('/estimating/analyze-image', {
    method: 'POST',
    body: { estimateId, fileId },
  });
  return {
    suggested: res.suggested ?? {},
    summary: res.summary ?? '',
    assumptions: Array.isArray(res.assumptions) ? res.assumptions : [],
  };
}
