"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptSanitizer = void 0;
/**
 * Security & Input Sanitizer for AI Prompts and AI Outputs
 * Prevents prompt injection, XSS vectors, and unauthorized secret leakage.
 */
class PromptSanitizer {
    static DANGEROUS_PATTERNS = [
        /ignore previous instructions/i,
        /bypass system limits/i,
        /reveal system prompt/i,
        /output secret keys/i,
        /export all database entries/i,
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
    ];
    static sanitizeInput(input) {
        if (!input)
            return "";
        let clean = input.trim();
        for (const pattern of PromptSanitizer.DANGEROUS_PATTERNS) {
            clean = clean.replace(pattern, "[REDACTED_POTENTIAL_PROMPT_INJECTION]");
        }
        // Limit maximum length to 10,000 chars to avoid memory denial of service
        if (clean.length > 10000) {
            clean = clean.substring(0, 10000);
        }
        return clean;
    }
    static sanitizeOutput(output) {
        if (!output)
            return "";
        // Redact potential API keys or secret patterns
        let safe = output
            .replace(/sk-[a-zA-Z0-9]{32,}/g, "[REDACTED_API_KEY]")
            .replace(/gho_[a-zA-Z0-9]{30,}/g, "[REDACTED_GITHUB_TOKEN]")
            .replace(/xoxb-[a-zA-Z0-9-]+/g, "[REDACTED_SLACK_TOKEN]");
        return safe;
    }
}
exports.PromptSanitizer = PromptSanitizer;
//# sourceMappingURL=sanitizer.js.map