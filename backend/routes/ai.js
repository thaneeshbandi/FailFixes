// backend/routes/ai.js
const express = require('express');
const router = express.Router();
const { generateStoryWithAI } = require('../controllers/siController');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { validateAiPrompt } = require('../middleware/validation');

// POST /api/ai/generate-story
//
// This endpoint proxies a paid third-party LLM (Groq) using the deployment's own
// API key. It was previously unauthenticated and unmetered, i.e. a free public
// LLM proxy that anyone could point at the owner's billing account.
//
// Order matters: authenticate first so the rate limiter can key on the user id
// rather than an easily-rotated IP, then validate before doing any upstream work.
router.post('/generate-story', protect, aiLimiter, validateAiPrompt, generateStoryWithAI);

module.exports = router;
