/**
 * Vercel serverless function: GET /api/horizons
 * Same handler as the dev server — see api/_lib/horizons-handler.ts.
 */
import { handleHorizons } from './_lib/horizons-handler';

export function GET(request: Request) {
  return handleHorizons(request);
}
