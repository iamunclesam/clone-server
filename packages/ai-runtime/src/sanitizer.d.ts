/**
 * Security & Input Sanitizer for AI Prompts and AI Outputs
 * Prevents prompt injection, XSS vectors, and unauthorized secret leakage.
 */
export declare class PromptSanitizer {
    private static DANGEROUS_PATTERNS;
    static sanitizeInput(input: string): string;
    static sanitizeOutput(output: string): string;
}
//# sourceMappingURL=sanitizer.d.ts.map