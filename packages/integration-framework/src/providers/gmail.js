"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailIntegrationProvider = void 0;
let _cachedParsedCreds = null;
function parseGoogleOAuthCreds() {
    if (_cachedParsedCreds)
        return _cachedParsedCreds;
    const rawClientJson = process.env.GOOGLE_OAUTH_CLIENT_JSON || process.env.GOOGLE_CLIENT_SECRET_JSON || process.env.GOOGLE_CLIENT_JSON || "";
    if (rawClientJson) {
        try {
            const json = JSON.parse(rawClientJson);
            const web = json.web || json.installed || json.desktop;
            if (web && web.client_id && web.client_secret) {
                _cachedParsedCreds = {
                    clientId: String(web.client_id),
                    clientSecret: String(web.client_secret),
                    source: "client_secret_json",
                };
                return _cachedParsedCreds;
            }
            if (json.type === "service_account" && json.client_email && json.private_key) {
                const impersonate = process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE_USER || "";
                _cachedParsedCreds = {
                    clientId: String(json.client_id || "service_account"),
                    clientSecret: String(json.private_key_id || ""),
                    source: "service_account_json",
                    serviceAccountEmail: String(json.client_email),
                    privateKey: String(json.private_key),
                    userImpersonationEmail: impersonate,
                };
                return _cachedParsedCreds;
            }
            console.warn("GOOGLE_OAUTH_CLIENT_JSON was provided but is not a valid web/installed OAuth client JSON or service_account JSON.");
        }
        catch (e) {
            console.warn("Failed to parse GOOGLE_OAUTH_CLIENT_JSON:", e?.message);
        }
    }
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    _cachedParsedCreds = { clientId, clientSecret, source: "env" };
    return _cachedParsedCreds;
}
function classifyGoogleTokenError(bodyText) {
    let hint = "";
    try {
        const j = JSON.parse(bodyText);
        const err = (j.error || "");
        const desc = (j.error_description || "");
        if (err === "invalid_client" || /client id|client_secret/i.test(desc)) {
            hint = " Google OAuth credentials invalid. Verify GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET match a 'Web application' OAuth client in Google Cloud Console. If you pasted a 'Service account key' JSON, use GOOGLE_OAUTH_CLIENT_JSON + GOOGLE_SERVICE_ACCOUNT_IMPERSONATE_USER instead.";
        }
        else if (err === "redirect_uri_mismatch") {
            hint = " Redirect URI mismatch. In Google Cloud Console → OAuth 2.0 Client IDs → your Web client → Authorized redirect URIs, add exactly: http://localhost:4000/api/v1/integrations/gmail/callback (plus production URL if any).";
        }
        else if (err === "invalid_grant") {
            hint = " Refresh/authorization token invalid or revoked. Reconnect Gmail in Clone integrations settings.";
        }
        else if (err === "unauthorized_client" || /scope/i.test(desc)) {
            hint = " OAuth app type mismatch. Ensure you created a 'Web application' client (not 'Desktop app' or 'iOS/Android'), or for a service account JSON use GOOGLE_OAUTH_CLIENT_JSON with domain-wide delegation + GOOGLE_SERVICE_ACCOUNT_IMPERSONATE_USER.";
        }
        if (err)
            hint = ` (${err}: ${desc.replace(/[<>\n\r]/g, " ").slice(0, 200)})${hint}`;
    }
    catch { }
    return hint;
}
async function getAccessTokenForServiceAccount(creds, scopes) {
    if (!creds.privateKey || !creds.serviceAccountEmail)
        return null;
    try {
        const { createSign } = await Promise.resolve().then(() => __importStar(require("crypto")));
        const now = Math.floor(Date.now() / 1000);
        const header = { alg: "RS256", typ: "JWT" };
        const claimSet = {
            iss: creds.serviceAccountEmail,
            scope: scopes.join(" "),
            aud: "https://oauth2.googleapis.com/token",
            iat: now,
            exp: now + 3600,
        };
        if (creds.userImpersonationEmail)
            claimSet.sub = creds.userImpersonationEmail;
        const encodeB64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
        const signingInput = `${encodeB64(header)}.${encodeB64(claimSet)}`;
        const signer = createSign("RSA-SHA256");
        signer.update(signingInput);
        const signature = signer.sign(creds.privateKey.replace(/\\n/g, "\n"), "base64url");
        const jwt = `${signingInput}.${signature}`;
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt,
            }).toString(),
        });
        if (!res.ok) {
            console.warn("Service account JWT exchange failed:", await res.text());
            return null;
        }
        const data = await res.json();
        return data.access_token || null;
    }
    catch (e) {
        console.warn("Service account token acquisition failed:", e?.message);
        return null;
    }
}
async function refreshGoogleAccessToken(refreshToken) {
    const creds = parseGoogleOAuthCreds();
    if (!creds.clientId || (!creds.clientSecret && creds.source === "env") || !refreshToken)
        return null;
    if (creds.source === "service_account_json") {
        return getAccessTokenForServiceAccount(creds, ["https://mail.google.com/"]);
    }
    try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: creds.clientId,
                client_secret: creds.clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }).toString(),
        });
        if (!res.ok) {
            const errText = await res.text();
            console.warn("Google token refresh failed:", errText, classifyGoogleTokenError(errText));
            return null;
        }
        const data = await res.json();
        return data.access_token || null;
    }
    catch (err) {
        console.warn("Network error during token refresh:", err?.message);
        return null;
    }
}
class GmailIntegrationProvider {
    providerId = "gmail";
    name = "Gmail";
    description = "Read support emails, draft client responses, and send verified email broadcasts.";
    category = "Communication";
    async getAuthorizationUrl(input) {
        const creds = parseGoogleOAuthCreds();
        if (!creds.clientId)
            throw new Error("GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_JSON is not configured");
        if (creds.source === "service_account_json") {
            throw new Error("Service account JSON was detected but Gmail OAuth flow is for end-user OAuth. Use a Web-app OAuth client JSON (GOOGLE_OAUTH_CLIENT_JSON) for the Connect button, or for service accounts enable Domain-Wide Delegation and set GOOGLE_SERVICE_ACCOUNT_IMPERSONATE_USER then connect via the manual / preconnected flow.");
        }
        const scopes = [
            "openid",
            "email",
            "profile",
            "https://mail.google.com/",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/userinfo.email",
        ].join(" ");
        const params = new URLSearchParams({
            client_id: creds.clientId,
            redirect_uri: input.redirectUri,
            response_type: "code",
            scope: scopes,
            state: input.state,
            access_type: "offline",
            prompt: "consent",
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    async handleCallback(input) {
        const creds = parseGoogleOAuthCreds();
        if (!creds.clientId || (!creds.clientSecret && creds.source === "env")) {
            throw new Error("Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_JSON) are not configured. Paste the full client_secret_*.json contents into GOOGLE_OAUTH_CLIENT_JSON.");
        }
        if (creds.source === "service_account_json") {
            throw new Error("handleCallback expects an OAuth user code flow, but GOOGLE_OAUTH_CLIENT_JSON is a service account key. Use Web application client JSON for Connect button flow.");
        }
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code: input.code,
                client_id: creds.clientId,
                client_secret: creds.clientSecret,
                redirect_uri: input.redirectUri,
                grant_type: "authorization_code",
            }).toString(),
        });
        if (!tokenRes.ok) {
            const errBody = await tokenRes.text();
            const hint = classifyGoogleTokenError(errBody);
            throw new Error(`Google token exchange failed${hint || ": " + errBody.slice(0, 400)}`);
        }
        const tokenData = await tokenRes.json();
        const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        let accountName = "Google Account";
        let accountEmail = "";
        if (profileRes.ok) {
            const profile = await profileRes.json();
            accountName = profile.name || accountName;
            accountEmail = profile.email || accountEmail;
        }
        else {
            const hint = classifyGoogleTokenError(await profileRes.text());
            console.warn("Google profile fetch failed:", profileRes.status, hint);
        }
        return {
            accountName,
            accountEmail,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            scopes: (tokenData.scope || "https://mail.google.com/").split(" ").filter(Boolean),
        };
    }
    async getCapabilities() {
        return [
            {
                name: "gmail.read_message",
                description: "Fetch recent unread customer support or internal emails.",
                inputSchema: { query: "string?", maxResults: "number?" },
                riskLevel: "low",
                requiresApproval: false,
                readOnly: true,
                requiredScopes: ["https://mail.google.com/"],
            },
            {
                name: "gmail.draft_message",
                description: "Prepare email drafts for human approval prior to dispatch.",
                inputSchema: { to: "string", subject: "string", body: "string" },
                riskLevel: "low",
                requiresApproval: false,
                readOnly: false,
                requiredScopes: ["https://mail.google.com/"],
            },
            {
                name: "gmail.send_message",
                description: "Send an email directly from the company support mailbox.",
                inputSchema: { to: "string", subject: "string", body: "string" },
                riskLevel: "high",
                requiresApproval: true,
                readOnly: false,
                requiredScopes: ["https://mail.google.com/"],
            },
        ];
    }
    async executeTool(input) {
        const initialAccessToken = input.arguments?.accessToken || "";
        const refreshToken = input.arguments?.refreshToken || "";
        let accessToken = initialAccessToken;
        let freshToken;
        const getUsableToken = async () => {
            const creds = parseGoogleOAuthCreds();
            if (creds.source === "service_account_json") {
                const t = await getAccessTokenForServiceAccount(creds, ["https://mail.google.com/", "https://www.googleapis.com/auth/userinfo.email"]);
                if (t) {
                    accessToken = t;
                    freshToken = t;
                    return t;
                }
            }
            if (accessToken)
                return accessToken;
            if (refreshToken) {
                const t = await refreshGoogleAccessToken(refreshToken);
                if (t) {
                    accessToken = t;
                    freshToken = t;
                    return t;
                }
            }
            return null;
        };
        const handle401 = async (res) => {
            if (res.status !== 401 || !refreshToken)
                return null;
            const t = await refreshGoogleAccessToken(refreshToken);
            if (!t)
                return null;
            accessToken = t;
            freshToken = t;
            const orig = res._request;
            if (!orig)
                return null;
            try {
                return fetch(orig.url, {
                    method: orig.method,
                    headers: { ...orig.headers, Authorization: `Bearer ${t}` },
                    body: orig.body,
                });
            }
            catch {
                return null;
            }
        };
        if (input.toolName === "gmail.read_message") {
            const token = await getUsableToken();
            if (!token)
                return { success: false, data: null, error: "No Gmail access token available. Reconnect Gmail in integrations settings." };
            try {
                const q = input.arguments?.query || "";
                const maxR = Math.max(1, Math.min(20, input.arguments?.maxResults || 5));
                const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxR}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
                const reqInit = { method: "GET", headers: { Authorization: `Bearer ${token}` } };
                let listRes = await fetch(listUrl, reqInit);
                listRes._request = { ...reqInit, url: listUrl };
                if (listRes.status === 401) {
                    const retried = await handle401(listRes);
                    if (retried)
                        listRes = retried;
                }
                if (listRes.ok) {
                    const listData = await listRes.json();
                    const realMessages = [];
                    if (listData.messages && listData.messages.length > 0) {
                        for (const msgRef of listData.messages.slice(0, maxR)) {
                            const mUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=full`;
                            const mReq = { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } };
                            let msgRes = await fetch(mUrl, mReq);
                            msgRes._request = { ...mReq, url: mUrl };
                            if (msgRes.status === 401) {
                                const retried = await handle401(msgRes);
                                if (retried)
                                    msgRes = retried;
                            }
                            if (msgRes.ok) {
                                const msgData = await msgRes.json();
                                const headers = msgData.payload?.headers || [];
                                const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "Unknown Sender";
                                const subjectHeader = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "(No Subject)";
                                const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";
                                realMessages.push({ id: msgData.id, snippet: msgData.snippet || "", from: fromHeader, subject: subjectHeader, date: dateHeader });
                            }
                        }
                    }
                    return {
                        success: true,
                        data: { messages: realMessages, totalCount: realMessages.length, freshToken },
                    };
                }
                const errTxt = await listRes.text();
                return { success: false, data: null, error: `Gmail list messages failed (${listRes.status}): ${errTxt.slice(0, 300)}${classifyGoogleTokenError(errTxt)}` };
            }
            catch (err) {
                return { success: false, data: null, error: `Gmail read network error: ${err?.message || String(err)}` };
            }
        }
        if (input.toolName === "gmail.draft_message") {
            const token = await getUsableToken();
            if (!token)
                return { success: false, data: null, error: "No Gmail access token available. Reconnect Gmail in integrations settings." };
            try {
                const { to, subject, body } = input.arguments;
                if (!to || !subject)
                    return { success: false, data: null, error: "gmail.draft_message requires 'to' and 'subject' fields" };
                const rawEmail = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "MIME-Version: 1.0", "", body].join("\r\n");
                const base64Encoded = Buffer.from(rawEmail).toString("base64url");
                const url = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
                const reqInit = {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ message: { raw: base64Encoded } }),
                };
                let res = await fetch(url, reqInit);
                res._request = { ...reqInit, url };
                if (res.status === 401) {
                    const retried = await handle401(res);
                    if (retried)
                        res = retried;
                }
                if (res.ok) {
                    const draftData = await res.json();
                    return { success: true, data: { draftId: draftData.id, status: "DRAFT_CREATED", freshToken } };
                }
                const errTxt = await res.text();
                return { success: false, data: null, error: `Gmail draft creation failed (${res.status}): ${errTxt.slice(0, 300)}${classifyGoogleTokenError(errTxt)}` };
            }
            catch (e) {
                return { success: false, data: null, error: `Gmail draft network error: ${e?.message || String(e)}` };
            }
        }
        if (input.toolName === "gmail.send_message") {
            const token = await getUsableToken();
            if (!token)
                return { success: false, data: null, error: "No Gmail access token available. Reconnect Gmail in integrations settings." };
            const buildRaw = (to, subject, body) => {
                const rawEmail = [
                    `To: ${to}`,
                    `Subject: ${subject}`,
                    "Content-Type: text/plain; charset=utf-8",
                    "MIME-Version: 1.0",
                    "",
                    body,
                ].join("\r\n");
                return Buffer.from(rawEmail).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            };
            const sendWithToken = async (t) => {
                const { to, subject, body } = input.arguments;
                if (!to)
                    throw new Error("gmail.send_message requires a 'to' recipient email");
                const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
                const bodyPayload = JSON.stringify({ raw: buildRaw(to, subject, body) });
                const reqInit = {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${t}`,
                        "Content-Type": "application/json",
                    },
                    body: bodyPayload,
                };
                let res = await fetch(url, reqInit);
                res._request = { ...reqInit, url };
                if (res.status === 401 && refreshToken && t === accessToken) {
                    const retried = await handle401(res);
                    if (retried)
                        res = retried;
                }
                return res;
            };
            try {
                let res = await sendWithToken(accessToken);
                if (res.ok) {
                    const sendData = await res.json();
                    console.log("✅ Gmail send_message success, messageId:", sendData.id);
                    return {
                        success: true,
                        data: {
                            messageId: sendData.id,
                            sent: true,
                            freshToken: freshToken !== initialAccessToken ? accessToken : undefined,
                        },
                    };
                }
                const errText = await res.text();
                const hint = classifyGoogleTokenError(errText);
                console.warn("Gmail API send_message failed:", res.status, errText, hint);
                return { success: false, data: null, error: `Gmail send failed (${res.status}): ${errText.slice(0, 400)}${hint}` };
            }
            catch (e) {
                console.warn("Failed to dispatch real email via Gmail API:", e);
                return { success: false, data: null, error: `Gmail send network error: ${e?.message || String(e)}` };
            }
        }
        throw new Error(`Unknown Gmail tool: ${input.toolName}`);
    }
    async disconnect() { }
}
exports.GmailIntegrationProvider = GmailIntegrationProvider;
//# sourceMappingURL=gmail.js.map