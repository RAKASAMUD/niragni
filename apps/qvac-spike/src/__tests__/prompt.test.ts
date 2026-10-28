import {
  DEFAULT_BARA_INDONESIAN_PROMPT,
  validateFirePromptInput,
  preserveInputsOnError
} from '../prompt';
import { AppState } from '../types';

describe('Bara Fire Observation Prompt Validation & State Preservation', () => {
  it('provides a source-grounded Indonesian fire observation prompt', () => {
    expect(DEFAULT_BARA_INDONESIAN_PROMPT).toContain('karhutla');
    expect(DEFAULT_BARA_INDONESIAN_PROMPT).toContain('belum diketahui');
    expect(DEFAULT_BARA_INDONESIAN_PROMPT).toContain('DILARANG merekayasa');
    expect(DEFAULT_BARA_INDONESIAN_PROMPT).toContain('korban');
    expect(DEFAULT_BARA_INDONESIAN_PROMPT).toContain('luas lahan');
    expect(DEFAULT_BARA_INDONESIAN_PROMPT).toContain('penyebab kebakaran');
  });

  it('rejects input when both user notes and photo are empty', () => {
    const res = validateFirePromptInput({ userNotes: '   ' });
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain('Catatan pengamatan atau foto bukti wajib disertakan');
  });

  it('accepts notes-only observation and marks missing photo/location/time as belum diketahui', () => {
    const res = validateFirePromptInput({
      userNotes: 'Terlihat asap tebal membubung di seberang sungai'
    });
    expect(res.isValid).toBe(true);
    expect(res.hasPhoto).toBe(false);
    expect(res.incidentLocationText).toBe('belum diketahui');
    expect(res.observationTimeText).toBe('belum diketahui');
    expect(res.sanitizedPrompt).toContain('Terlihat asap tebal');
    expect(res.sanitizedPrompt).toContain('Perkiraan Arah/Jarak Kejadian: belum diketahui');
    expect(res.sanitizedPrompt).toContain('Waktu Pengamatan: belum diketahui');
  });

  it('accepts photo with location context and preserves provided data', () => {
    const res = validateFirePromptInput({
      userNotes: 'Asap putih keabu-abuan dari arah kebun sawit tua',
      photoUri: 'file:///data/user/0/com.niragni.qvacspike/files/asap.jpg',
      incidentLocationText: 'Arah barat daya sekitar 1.5 km',
      observationTimeText: '10:30 WIB'
    });
    expect(res.isValid).toBe(true);
    expect(res.hasPhoto).toBe(true);
    expect(res.incidentLocationText).toBe('Arah barat daya sekitar 1.5 km');
    expect(res.observationTimeText).toBe('10:30 WIB');
    expect(res.sanitizedPrompt).toContain('Arah barat daya sekitar 1.5 km');
    expect(res.sanitizedPrompt).toContain('10:30 WIB');
  });

  it('strictly preserves fire observation text, location, time, and photo on error', () => {
    const initialState: AppState = {
      selectedCandidateId: 'smolvlm2-500m',
      modelPath: '/data/user/0/com.niragni.qvacspike/files/smolvlm2.gguf',
      projectorPath: '/data/user/0/com.niragni.qvacspike/files/mmproj.gguf',
      photoUri: 'file:///data/user/0/com.niragni.qvacspike/cache/asap_lahan.jpg',
      userNotes: 'Asap hitam membumbung tinggi dari semak belukar',
      incidentLocationText: 'Kira-kira 2 km utara desa',
      observationTimeText: '15:20 WIB',
      phase: 'inferring',
      readiness: null,
      outputText: 'Draf parsial yang terputus...',
      errorMessage: null,
      lastStats: null
    };

    const errorState = preserveInputsOnError(initialState, 'Native OutOfMemory error during KV-cache allocation');

    expect(errorState.phase).toBe('error');
    expect(errorState.errorMessage).toBe('Native OutOfMemory error during KV-cache allocation');
    // Critical: user fire observations MUST be preserved
    expect(errorState.userNotes).toBe('Asap hitam membumbung tinggi dari semak belukar');
    expect(errorState.photoUri).toBe('file:///data/user/0/com.niragni.qvacspike/cache/asap_lahan.jpg');
    expect(errorState.incidentLocationText).toBe('Kira-kira 2 km utara desa');
    expect(errorState.observationTimeText).toBe('15:20 WIB');
    expect(errorState.modelPath).toBe('/data/user/0/com.niragni.qvacspike/files/smolvlm2.gguf');
    expect(errorState.projectorPath).toBe('/data/user/0/com.niragni.qvacspike/files/mmproj.gguf');
    // Critical: partial/false output must be cleared
    expect(errorState.outputText).toBe('');
  });
});
