// backend/controllers/siController.js
const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 2000;
const MAX_OUTPUT_TOKENS = 1024;
const UPSTREAM_TIMEOUT_MS = 30000;

const SYSTEM_PROMPT =
  'You are a creative writer. Generate a human-readable story with a clear, ' +
  'catchy title as the first line, then the actual story text. ' +
  'Do not include markdown or code blocks.';

// POST /api/ai/generate-story
// Auth + rate limiting are enforced by the route (routes/ai.js).
exports.generateStoryWithAI = async (req, res) => {
  const { prompt } = req.body || {};

  // ---- input validation ----
  if (typeof prompt !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Prompt is required',
      code: 'INVALID_PROMPT',
    });
  }

  const cleanPrompt = prompt.trim();

  if (cleanPrompt.length < MIN_PROMPT_LENGTH) {
    return res.status(400).json({
      success: false,
      error: 'Prompt is too short',
      code: 'INVALID_PROMPT',
    });
  }

  // Hard cap. Without one, an attacker could push a multi-megabyte prompt
  // (the body limit used to be 10MB) straight onto the owner's Groq bill.
  if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `Prompt cannot exceed ${MAX_PROMPT_LENGTH} characters`,
      code: 'PROMPT_TOO_LONG',
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Configuration problem — say the feature is unavailable, not why.
    console.error('[AI] GROQ_API_KEY is not configured');
    return res.status(503).json({
      success: false,
      error: 'AI generation is currently unavailable',
      code: 'AI_UNAVAILABLE',
    });
  }

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: cleanPrompt },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.8,
        stream: false,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: UPSTREAM_TIMEOUT_MS,
      }
    );

    const output = response.data?.choices?.[0]?.message?.content || '';
    const [firstLine, ...rest] = output.trim().split('\n');
    const title = firstLine && firstLine.trim() ? firstLine.trim() : 'AI Generated Story';
    const content = rest.join('\n').trim();

    // The model's output is returned as plain JSON strings and rendered by React
    // as escaped text, so there is no HTML/markdown injection sink here. It is
    // still untrusted content — it is never executed, evaluated, or used to
    // build a query.
    return res.json({ success: true, title, content });
  } catch (err) {
    // Log the upstream detail server-side...
    const upstreamStatus = err.response?.status;
    console.error('[AI] Groq request failed', {
      status: upstreamStatus,
      code: err.code,
      message: err.message,
      userId: req.user?._id?.toString(),
    });

    // ...but never relay the provider's message to the client. It can disclose
    // account/quota/model details and, on some providers, fragments of the
    // request that was sent.
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        error: 'AI generation timed out. Please try again.',
        code: 'AI_TIMEOUT',
      });
    }

    if (upstreamStatus === 429) {
      return res.status(503).json({
        success: false,
        error: 'AI generation is busy. Please try again shortly.',
        code: 'AI_BUSY',
      });
    }

    return res.status(502).json({
      success: false,
      error: 'AI generation failed. Please try again.',
      code: 'AI_FAILED',
    });
  }
};

module.exports.MAX_PROMPT_LENGTH = MAX_PROMPT_LENGTH;
