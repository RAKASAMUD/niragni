/**
 * Single integration point for the frozen product services.
 *
 * AGY implements `export const services: ProductServices` at src/core/index.ts
 * (per product-contract.ts and the product plan). The UI imports it ONLY here so
 * there is one resolve point at integration time.
 */
export { services } from '../core/index';
export type {
  Source,
  Observation,
  Suggestion,
  Position,
  Attachment,
  SenderSelfie,
  ShareAttempt,
  ShareStage,
  Report,
  ModelState,
  Channel,
  AiResult,
  ExportPreview,
  ProductServices,
} from '../product-contract';
