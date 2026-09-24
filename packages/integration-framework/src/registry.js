"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationRegistry = void 0;
const github_1 = require("./providers/github");
const slack_1 = require("./providers/slack");
const gmail_1 = require("./providers/gmail");
const notion_1 = require("./providers/notion");
const linear_1 = require("./providers/linear");
class IntegrationRegistry {
    static instance;
    providers = new Map();
    constructor() {
        this.registerProvider(new github_1.GitHubIntegrationProvider());
        this.registerProvider(new slack_1.SlackIntegrationProvider());
        this.registerProvider(new gmail_1.GmailIntegrationProvider());
        this.registerProvider(new notion_1.NotionIntegrationProvider());
        this.registerProvider(new linear_1.LinearIntegrationProvider());
    }
    static getInstance() {
        if (!IntegrationRegistry.instance) {
            IntegrationRegistry.instance = new IntegrationRegistry();
        }
        return IntegrationRegistry.instance;
    }
    registerProvider(provider) {
        this.providers.set(provider.providerId, provider);
    }
    getProvider(providerId) {
        return this.providers.get(providerId);
    }
    getAllProviders() {
        return Array.from(this.providers.values());
    }
}
exports.IntegrationRegistry = IntegrationRegistry;
//# sourceMappingURL=registry.js.map