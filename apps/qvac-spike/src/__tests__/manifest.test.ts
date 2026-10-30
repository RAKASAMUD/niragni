import {
  CANDIDATE_SMOLVLM2,
  CANDIDATE_VISIONPSY,
  verifyFileIntegrity,
  verifyModelPair
} from '../manifest';

describe('Model Manifest & Strict Integrity Verification', () => {
  it('defines candidate SmolVLM2 500M with verified metadata from audit', () => {
    expect(CANDIDATE_SMOLVLM2.id).toBe('smolvlm2-500m');
    expect(CANDIDATE_SMOLVLM2.license).toBe('Apache-2.0');
    expect(CANDIDATE_SMOLVLM2.modelFile.filename).toBe('SmolVLM2-500M-Video-Instruct-Q8_0.gguf');
    expect(CANDIDATE_SMOLVLM2.modelFile.expectedBytes).toBe(436808704);
    expect(CANDIDATE_SMOLVLM2.modelFile.expectedSha256).toBe(
      '6f67b8036b2469fcd71728702720c6b51aebd759b78137a8120733b4d66438bc'
    );
    expect(CANDIDATE_SMOLVLM2.projectorFile.filename).toBe('mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf');
    expect(CANDIDATE_SMOLVLM2.projectorFile.expectedBytes).toBe(108785184);
    expect(CANDIDATE_SMOLVLM2.projectorFile.expectedSha256).toBe(
      '921dc7e259f308e5b027111fa185efcbf33db13f6e35749ddf7f5cdb60ef520b'
    );
    expect(CANDIDATE_SMOLVLM2.recommendedConfig.device).toBe('cpu');
  });

  it('defines candidate VisionPsy Nano 460M with image_no_upscale flag', () => {
    expect(CANDIDATE_VISIONPSY.id).toBe('visionpsy-nano-460m');
    expect(CANDIDATE_VISIONPSY.license).toBe('Apache-2.0');
    expect(CANDIDATE_VISIONPSY.modelFile.filename).toBe('visionpsy-nano-460m-flash-q8_0.gguf');
    expect(CANDIDATE_VISIONPSY.modelFile.expectedBytes).toBe(436676000);
    expect(CANDIDATE_VISIONPSY.projectorFile.expectedBytes).toBe(108782144);
    expect(CANDIDATE_VISIONPSY.recommendedConfig.image_no_upscale).toBe('on');
  });

  it('detects missing files accurately', () => {
    const res = verifyFileIntegrity(CANDIDATE_SMOLVLM2.modelFile, { exists: false });
    expect(res.exists).toBe(false);
    expect(res.status).toBe('missing');
    expect(res.message).toContain('tidak ditemukan');
  });

  it('detects file size mismatches accurately', () => {
    const res = verifyFileIntegrity(CANDIDATE_SMOLVLM2.modelFile, {
      exists: true,
      byteSize: 12345
    });
    expect(res.exists).toBe(true);
    expect(res.status).toBe('size_mismatch');
    expect(res.message).toContain('Ukuran berkas tidak cocok');
  });

  it('treats files with matching size but missing SHA-256 as unverified (NEVER valid)', () => {
    const res = verifyFileIntegrity(CANDIDATE_SMOLVLM2.modelFile, {
      exists: true,
      byteSize: 436808704
      // sha256 omitted
    });
    expect(res.exists).toBe(true);
    expect(res.status).toBe('unverified');
    expect(res.message).toContain('SHA-256 belum dihitung');
  });

  it('detects hash mismatches accurately', () => {
    const res = verifyFileIntegrity(CANDIDATE_SMOLVLM2.modelFile, {
      exists: true,
      byteSize: 436808704,
      sha256: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    });
    expect(res.status).toBe('hash_mismatch');
    expect(res.message).toContain('SHA-256 checksum tidak cocok');
  });

  it('marks file as valid ONLY when both size and SHA-256 match expected values', () => {
    const res = verifyFileIntegrity(CANDIDATE_SMOLVLM2.modelFile, {
      exists: true,
      byteSize: 436808704,
      sha256: '6f67b8036b2469fcd71728702720c6b51aebd759b78137a8120733b4d66438bc'
    });
    expect(res.status).toBe('valid');
    expect(res.message).toContain('terverifikasi valid');
  });

  it('verifies pair readiness is FALSE when SHA-256 is uncomputed on either file', () => {
    const readiness = verifyModelPair(
      CANDIDATE_SMOLVLM2,
      { exists: true, byteSize: 436808704, sha256: CANDIDATE_SMOLVLM2.modelFile.expectedSha256 },
      { exists: true, byteSize: 108785184 } // sha256 missing
    );
    expect(readiness.isReady).toBe(false);
    expect(readiness.modelStatus.status).toBe('valid');
    expect(readiness.projectorStatus.status).toBe('unverified');
  });

  it('verifies pair readiness is TRUE only when BOTH model and projector have matching SHA-256', () => {
    const readiness = verifyModelPair(
      CANDIDATE_SMOLVLM2,
      { exists: true, byteSize: 436808704, sha256: CANDIDATE_SMOLVLM2.modelFile.expectedSha256 },
      { exists: true, byteSize: 108785184, sha256: CANDIDATE_SMOLVLM2.projectorFile.expectedSha256 }
    );
    expect(readiness.isReady).toBe(true);
    expect(readiness.details).toContain('terverifikasi lengkap');
  });
});
