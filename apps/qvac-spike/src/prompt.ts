/**
 * Indonesian prompt building, validation, and state preservation for Bara QVAC Spike.
 * Aligned with Bara PRD v0.9: Citizen forest and land fire (karhutla) observation drafting.
 */

import { FireObservationInput, AppState } from './types';

export const DEFAULT_BARA_INDONESIAN_PROMPT = 
  'Buat draf observasi dugaan kebakaran hutan dan lahan (karhutla) berdasarkan bukti catatan dan foto ini. ' +
  'Uraikan kondisi teramati secara faktual: warna dan kepekatan asap, apakah api tampak jelas atau hanya asap, dan tipe lingkungan sekitar (lahan gambut/semak/hutan/perkebunan). ' +
  'Tuliskan "belum diketahui" secara tegas untuk lokasi kejadian, waktu pengamatan, perkiraan luas lahan, atau penyebab kebakaran jika tidak ada dalam catatan input. ' +
  'DILARANG merekayasa koordinat GPS, korban jiwa/luka, luas area, penyebab api, atau status penanganan instansi. ' +
  'Sertakan maksimal 3 pertanyaan pelengkap yang sopan dan relevan untuk melengkapi draf. ' +
  'Jawab seluruhnya dalam bahasa Indonesia.';

export interface PromptValidationResult {
  readonly isValid: boolean;
  readonly sanitizedPrompt: string;
  readonly hasPhoto: boolean;
  readonly incidentLocationText: string;
  readonly observationTimeText: string;
  readonly errorMessage?: string;
}

/**
 * Builds structured context and validates inputs for Bara citizen fire observation drafting.
 */
export function validateFirePromptInput(input: FireObservationInput): PromptValidationResult {
  const notes = (input.userNotes || '').trim();
  const hasPhoto = Boolean(input.photoUri && input.photoUri.trim().length > 0);

  if (!notes && !hasPhoto) {
    return {
      isValid: false,
      sanitizedPrompt: '',
      hasPhoto: false,
      incidentLocationText: 'belum diketahui',
      observationTimeText: 'belum diketahui',
      errorMessage: 'Catatan pengamatan atau foto bukti wajib disertakan untuk menyusun draf observasi.'
    };
  }

  const incidentLocation = (input.incidentLocationText || '').trim() || 'belum diketahui';
  const observationTime = (input.observationTimeText || '').trim() || 'belum diketahui';

  const structuredPrompt = 
    `${DEFAULT_BARA_INDONESIAN_PROMPT}\n\n` +
    `[Konteks Input Warga]:\n` +
    `- Catatan Pelapor: ${notes || '(Pengamatan visual dari foto terlampir)'}\n` +
    `- Perkiraan Arah/Jarak Kejadian: ${incidentLocation}\n` +
    `- Waktu Pengamatan: ${observationTime}\n` +
    `- Lampiran Foto: ${hasPhoto ? 'Tersedia foto lapangan' : 'Tidak ada foto'}`;

  return {
    isValid: true,
    sanitizedPrompt: structuredPrompt,
    hasPhoto,
    incidentLocationText: incidentLocation,
    observationTimeText: observationTime
  };
}

/**
 * Ensures that user notes, photo selections, and location/time context
 * are strictly preserved on error, preventing data loss and clearing any false success claims.
 */
export function preserveInputsOnError(
  currentState: AppState,
  errorMessage: string
): AppState {
  return {
    ...currentState,
    phase: 'error',
    errorMessage,
    outputText: '', // Never display partial or false output on error
    // Keep all user inputs intact
    userNotes: currentState.userNotes,
    photoUri: currentState.photoUri,
    incidentLocationText: currentState.incidentLocationText,
    observationTimeText: currentState.observationTimeText,
    modelPath: currentState.modelPath,
    projectorPath: currentState.projectorPath,
    selectedCandidateId: currentState.selectedCandidateId
  };
}
