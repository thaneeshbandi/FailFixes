// backend/routes/ai.js
const express = require("express");
const router = express.Router();
const { generateStoryWithAI } = require("../controllers/siController");

router.post("/generate-story", generateStoryWithAI);

module.exports = router;
