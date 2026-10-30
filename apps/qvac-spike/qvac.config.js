import { PLUGIN_LLM } from '@qvac/sdk';

/**
 * QVAC configuration for Bara text+photo vision spike.
 * Tree-shakes out unused audio, tts, audiogen, and video plugins,
 * ensuring only the native LLM completion engine is bundled.
 */
export default {
  plugins: [PLUGIN_LLM],
  includeAudioDecoder: false
};
