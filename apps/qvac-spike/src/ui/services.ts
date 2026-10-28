/**
 * Single integration point for the frozen product services.
 *
 * AGY implements `export const services: ProductServices` at src/core/index.ts
 * (per product-contract.ts and the product plan). The UI imports it ONLY here so
 * there is one resolve point at integration time. No fake/mock service is
 * provided — if the module is missing the app fails to build, which is correct:
 * the UI must never present a stub service as if it worked.
 *
 * Imports are extensionless (Metro/Expo resolves TS; a ".js" specifier pointing
 * at a .ts source broke a prior spike bundle).
 */
export { services } from '../core/index';
export type {
  Source,
  Observation,
  Suggestion,
  Position,
  Attachment,
  ShareAttempt,
  Report,
  ModelState,
  Channel,
  AiResult,
  ExportPreview,
  ProductServices,
} from '../product-contract';
