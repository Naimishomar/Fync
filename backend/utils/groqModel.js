/**
 * The Groq models every call site uses.
 *
 * This exists because `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` were
 * both removed from Groq's catalogue and every chat completion started
 * returning 404 — which took the entire AI interview down, since
 * startInterview has no fallback and just 500s.
 *
 * Hosted model catalogues turn over every few months. Keeping the names in one
 * env-overridable place means the next retirement is a restart, not an outage.
 *
 * Check what is actually available with:
 *   curl -s https://api.groq.com/openai/v1/models \
 *     -H "Authorization: Bearer $GROQ_API_KEY" | jq -r '.data[].id' | sort
 *
 * A note on openai/gpt-oss-*: those models spend tokens on hidden reasoning
 * before answering, so a small max_tokens can return EMPTY content with
 * finish_reason "length". If you switch to one, set reasoning_effort: 'low'
 * and leave headroom in max_tokens. The qwen models below have no such trap,
 * which is why they are the default for the conversational path.
 */

/** Background summarisation. Nobody is waiting on it. */
export const GROQ_MODEL_FAST = process.env.GROQ_MODEL_FAST || "qwen/qwen3.8-27b";

/** The interview itself — questions and follow-ups. Chosen for time to first
 *  token (~410ms streaming), because that is what makes a reply feel live. */
export const GROQ_MODEL_CHAT = process.env.GROQ_MODEL_CHAT || "qwen/qwen3.8-27b";

/** The final evaluation. Runs once, off the critical path, and must emit
 *  valid JSON — verified against response_format: json_object. */
export const GROQ_MODEL_REPORT = process.env.GROQ_MODEL_REPORT || "openai/gpt-oss-120b";

/** Speech to text. The turbo variant is materially faster at the same price. */
export const GROQ_MODEL_STT = process.env.GROQ_MODEL_STT || "whisper-large-v3-turbo";
