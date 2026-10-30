jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() }))
  }
}));

jest.mock('@qvac/sdk', () => ({
  loadModel: jest.fn(),
  completion: jest.fn(),
  unloadModel: jest.fn(),
  cancel: jest.fn(),
  InferenceCancelledError: class InferenceCancelledError extends Error {}
}));

import { buildResponseJsonSchema } from '../core/ai';

describe('AI response JSON schema (grammar-constrained decoding)', () => {
  const schema = buildResponseJsonSchema() as any;

  it('is a plain object schema without a $schema keyword', () => {
    expect(schema.type).toBe('object');
    expect(schema.$schema).toBeUndefined();
    expect(schema.additionalProperties).toBe(false);
  });

  it('requires exactly the four draft fields', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(
      ['missingFields', 'observations', 'questions', 'summary'].sort()
    );
    expect([...schema.required].sort()).toEqual(['missingFields', 'observations', 'questions', 'summary']);
  });

  it('restricts observation.source to the three allowed values and uncertain to a boolean', () => {
    const item = schema.properties.observations.items;
    expect(item.additionalProperties).toBe(false);
    expect(item.properties.source.enum).toEqual(['user', 'metadata', 'ai_visual']);
    expect(item.properties.uncertain.type).toBe('boolean');
    expect([...item.required].sort()).toEqual(['sourceRef', 'source', 'text', 'uncertain'].sort());
  });

  it('bounds output length so generation stays short on a phone CPU', () => {
    expect(schema.properties.questions.maxItems).toBe(3);
    expect(schema.properties.observations.maxItems).toBe(5);
    expect(schema.properties.summary.maxLength).toBe(400);
    expect(schema.properties.observations.items.properties.text.maxLength).toBe(200);
  });
});

import { containsTemplatePlaceholder } from '../core/ai';

describe('template placeholder guard', () => {
  it('flags echoed <placeholder> text', () => {
    expect(containsTemplatePlaceholder('<ringkasan faktual dari catatan warga>')).toBe(true);
    expect(containsTemplatePlaceholder('<satu pengamatan yang tertulis di catatan warga>')).toBe(true);
  });
  it('allows normal text, including comparisons', () => {
    expect(containsTemplatePlaceholder('Asap putih tebal dari arah kebun')).toBe(false);
    expect(containsTemplatePlaceholder('suhu < 30 dan angin > 5')).toBe(false);
  });
});
