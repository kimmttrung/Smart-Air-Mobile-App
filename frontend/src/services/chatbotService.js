// =============================================================================
// chatbotService.js — SmartAir AI Chatbot Service
// OpenAI-compatible Chat Completions API (POST /v1/chat/completions)
// Uses AI_SERVER_URL (separate from the main backend BASE_URL)
// =============================================================================

import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// AI_SERVER_URL resolution
// Priority: hardcoded local > env var > app.json extra > auto-detect > fallback
// ---------------------------------------------------------------------------

const ENV_AI_SERVER_URL = process.env.AI_SERVER_URL;

let CONFIG_AI_SERVER_URL =
  Constants.expoConfig?.extra?.aiServerUrl ||
  Constants.manifest?.extra?.aiServerUrl;
if (CONFIG_AI_SERVER_URL === 'AUTO_DISCOVER' || CONFIG_AI_SERVER_URL === '') {
  CONFIG_AI_SERVER_URL = null;
}

// Auto-detect from Expo debugger host (same machine, port 8000)
let detectedAiServerUrl = null;
try {
  const manifest = Constants.manifest || Constants.expoConfig || {};
  const expoConfig = Constants.expoConfig || {};
  const debuggerHost =
    manifest.debuggerHost ||
    manifest.extra?.debuggerHost ||
    expoConfig.extra?.debuggerHost ||
    null;

  if (debuggerHost) {
    const hostPart = debuggerHost.includes(':')
      ? debuggerHost.split(':')[0]
      : debuggerHost;
    if (
      hostPart &&
      hostPart !== 'localhost' &&
      hostPart !== '127.0.0.1' &&
      !hostPart.startsWith('127.')
    ) {
      detectedAiServerUrl = `http://${hostPart}:8000`;
    }
  }
} catch (_e) {
  // ignore
}

// ⚠️  Same backend as api.js (BASE_URL) — the chat endpoints now live on the
// main FastAPI server, not a separate AI server.
const LOCAL_AI_SERVER_URL = 'http://192.168.1.94:8000';
const DEFAULT_AI_FALLBACK = 'http://10.0.2.2:8000'; // Android emulator localhost

/**
 * Base URL for the AI / LLM server (OpenAI-compatible).
 */
export const AI_SERVER_URL =
  LOCAL_AI_SERVER_URL ||
  ENV_AI_SERVER_URL ||
  detectedAiServerUrl ||
  CONFIG_AI_SERVER_URL ||
  DEFAULT_AI_FALLBACK;

console.warn(`[chatbotService] 🤖 AI_SERVER_URL: ${AI_SERVER_URL}`);

// ---------------------------------------------------------------------------
// OpenAI API paths
// ---------------------------------------------------------------------------
const CHAT_COMPLETIONS_ENDPOINT = `${AI_SERVER_URL}/v1/chat/completions`;
const MODELS_ENDPOINT = `${AI_SERVER_URL}/v1/models`;
const HEALTH_ENDPOINT = `${AI_SERVER_URL}/health`;

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------
export const CHATBOT_CONFIG = {
  model: 'Qwen2.5-1.5b',
  top_k: 5,          // override per-call if needed
  temperature: 0.7,
  max_tokens: 512,
  timeoutMs: 60_000,
};

export const DEFAULT_SYSTEM_PROMPT = `Bạn là trợ lý AI thông minh của ứng dụng SmartAir — một ứng dụng theo dõi chất lượng không khí tại Việt Nam.

Nhiệm vụ của bạn:
- Giải thích các chỉ số AQI, PM2.5, PM10, CO2 một cách dễ hiểu
- Đưa ra lời khuyên sức khỏe phù hợp với từng mức độ ô nhiễm
- Trả lời câu hỏi về thời tiết, môi trường và sức khỏe hô hấp
- Hỗ trợ người dùng hiểu và sử dụng ứng dụng SmartAir

Phong cách trả lời:
- Ngắn gọn, thân thiện, dễ hiểu
- Dùng emoji phù hợp để làm nổi bật thông tin quan trọng
- Trả lời bằng tiếng Việt`;

// ---------------------------------------------------------------------------
// Internal: get auth token from AsyncStorage (optional — for secured backends)
// ---------------------------------------------------------------------------
const _getAuthToken = async () => {
  try {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    const authStr = await AsyncStorage.getItem('auth');
    if (!authStr) return null;
    const auth = JSON.parse(authStr);
    return auth.token || auth.access_token || null;
  } catch (_e) {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Internal: build request headers
// ---------------------------------------------------------------------------
const _buildHeaders = async () => {
  const token = await _getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// ---------------------------------------------------------------------------
// Core: POST /v1/chat/completions  (OpenAI Chat Completions format)
// ---------------------------------------------------------------------------

/**
 * Send a list of messages to the OpenAI-compatible endpoint and get a reply.
 *
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {object} [options]
 * @param {string}  [options.model]        Override model name.
 * @param {number}  [options.temperature]  Sampling temperature (0–2).
 * @param {number}  [options.max_tokens]   Max tokens in the response.
 * @param {number}  [options.timeoutMs]    Request timeout in ms.
 * @returns {Promise<string>}  The assistant's reply text.
 */
export const chatCompletion = async (messages, options = {}) => {
  const {
    model = CHATBOT_CONFIG.model,
    top_k = CHATBOT_CONFIG.top_k,
    temperature = CHATBOT_CONFIG.temperature,
    max_tokens = CHATBOT_CONFIG.max_tokens,
    timeoutMs = CHATBOT_CONFIG.timeoutMs,
    lat = null,   // vị trí user cho tool point-lookup ("chỗ tôi")
    lon = null,
    date = null,  // YYYYMMDD, tùy chọn
  } = options;

  console.warn(`[chatbotService] POST ${CHAT_COMPLETIONS_ENDPOINT}`)
  console.warn(
    `[chatbotService] coords ${lat != null && lon != null ? `lat=${lat} lon=${lon}` : 'KHÔNG có (câu "chỗ tôi" sẽ thiếu vị trí)'}`,
  );
  // console.log("Message: ",messages);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = await _buildHeaders();

    // OpenAI-compatible Chat Completions request body.
    // `top_k` is a non-standard extension consumed by the RAG backend to
    // control how many context chunks are retrieved; extra fields are
    // simply ignored by strict OpenAI-spec clients/servers.
    const body = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      top_k,
      stream: false, // non-streaming for simplicity
      // Gửi kèm toạ độ khi có -> backend dùng cho tool point-lookup.
      ...(lat != null && lon != null ? { lat, lon } : {}),
      ...(date ? { date } : {}),
    });

    const res = await fetch(CHAT_COMPLETIONS_ENDPOINT, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const raw = await res.text();
      let detail = raw;
      try {
        const json = JSON.parse(raw);
        detail = json.detail || json.error?.message || raw;
      } catch (_e) { /* not JSON */ }
      throw new Error(`HTTP ${res.status}: ${detail}`);
    }

    const data = await res.json();

    // Standard OpenAI response: { choices: [{ message: { content: string } }] }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Phản hồi từ AI trống hoặc không hợp lệ.');
    }

    return content.trim();
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      throw new Error('⏱️ Yêu cầu bị timeout. Vui lòng thử lại.');
    }
    if (
      err.message.includes('Network request failed') ||
      err.message.includes('Failed to fetch')
    ) {
      throw new Error(
        `🔌 Không thể kết nối tới AI server (${AI_SERVER_URL}).\nKiểm tra kết nối mạng và đảm bảo server đang chạy.`
      );
    }
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Convenience: sendChatMessage (used by AIChatScreen)
// ---------------------------------------------------------------------------

/**
 * Send a user message with conversation history and get the AI reply.
 *
 * @param {string} userMessage         The latest message from the user.
 * @param {Array}  [history=[]]        Previous messages [{role, content}].
 * @param {string} [systemPrompt]      Override the default system prompt.
 * @param {object} [options={}]        Extra options for chatCompletion().
 * @returns {Promise<string>}          The assistant's reply.
 */
export const sendChatMessage = async (
  userMessage,
  history = [],
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  options = {}
) => {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  return chatCompletion(messages, options);
};

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Check if the AI server is reachable.
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export const checkAIServerHealth = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      ok: res.ok,
      message: res.ok
        ? `✅ AI server online (${AI_SERVER_URL})`
        : `⚠️ AI server returned HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `❌ Cannot reach AI server at ${AI_SERVER_URL}`,
    };
  }
};

// ---------------------------------------------------------------------------
// List available models  GET /v1/models
// ---------------------------------------------------------------------------

/**
 * Fetch the list of models from the AI server.
 * @returns {Promise<string[]>}  Array of model IDs.
 */
export const listModels = async () => {
  try {
    const headers = await _buildHeaders();
    const res = await fetch(MODELS_ENDPOINT, { method: 'GET', headers });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data || []).map((m) => m.id);
  } catch (_e) {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------
const chatbotService = {
  AI_SERVER_URL,
  CHATBOT_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
  chatCompletion,
  sendChatMessage,
  checkAIServerHealth,
  listModels,
};

export default chatbotService;