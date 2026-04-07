// backend/controllers/aiController.js
const axios = require("axios");

// POST /api/ai/generate-story
exports.generateStoryWithAI = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    // Use Groq API key from environment
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Groq API key is not set in backend environment variables." });
    }

    const groqApiUrl = "https://api.groq.com/openai/v1/chat/completions";

    const response = await axios.post(
      groqApiUrl,
      {
        model: "llama-3.3-70b-versatile", // Updated Model (recommended by Groq)
        messages: [
          {
            role: "system",
            content: "You are a creative writer. Generate a human-readable story with a clear, catchy title as the first line, then the actual story text. Do not include markdown or code blocks."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 1024,
        temperature: 0.8,
        stream: false
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` }
      }
    );

    // Parse result: use the first non-empty line as title, the rest as content.
    let output = response.data.choices?.[0]?.message?.content || "";
    let [title, ...rest] = output.trim().split('\n');
    if (!title || !title.trim()) title = "AI Generated Story";
    const content = rest.join('\n').trim();

    res.json({ title: title.trim(), content });
  } catch (e) {
    console.error('[Groq AI error]', e?.response?.data || e.message || e);

    res.status(500).json({
      error: e?.response?.data?.error?.message || e.message || "AI Generation failed"
    });
  }
};
