import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <span className="font-semibold text-sm tracking-tight">Clone</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
            <a href="#employees" className="hover:text-white transition-colors">Employees</a>
            <a href="#integrations" className="hover:text-white transition-colors">Integrations</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-white text-black font-medium px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Now in early access — join 500+ founding teams
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6">
            Create AI employees.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-500">
              Connect their tools.
            </span>
            <br />
            Let them work.
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-10">
            Build a digital team with roles, memory, permissions, and real application access.
            Clone helps your AI employees plan, communicate, and execute work while you stay in control.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-white font-semibold text-sm hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/25"
            >
              Create your AI company →
            </Link>
            <a
              href="#workflow"
              className="px-6 py-3 rounded-xl border border-white/10 text-white/70 font-medium text-sm hover:border-white/20 hover:text-white transition-all"
            >
              Explore the workflow
            </a>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="max-w-5xl mx-auto mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0f] z-10 rounded-2xl" />
          <div className="rounded-2xl border border-white/10 bg-[#111118] overflow-hidden shadow-2xl shadow-black/50">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-1.5 px-4 h-9 border-b border-white/5 bg-[#0e0e16]">
              <div className="w-3 h-3 rounded-full bg-white/10" />
              <div className="w-3 h-3 rounded-full bg-white/10" />
              <div className="w-3 h-3 rounded-full bg-white/10" />
              <div className="flex-1 mx-4 h-5 rounded bg-white/5 text-[10px] text-white/20 flex items-center px-3">
                app.clone.ai/overview
              </div>
            </div>
            {/* Preview content */}
            <div className="flex h-72">
              {/* Sidebar preview */}
              <div className="w-48 border-r border-white/5 p-3 space-y-0.5 shrink-0">
                {["Overview", "AI Employees", "Teams", "Tasks", "Workflows", "Integrations", "Approvals", "Activity"].map((item, i) => (
                  <div
                    key={item}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${i === 0 ? "bg-white/8 text-white" : "text-white/30"}`}
                  >
                    <div className="w-3 h-3 rounded bg-white/10" />
                    {item}
                  </div>
                ))}
              </div>
              {/* Main area preview */}
              <div className="flex-1 p-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "AI Employees", value: "5", color: "blue" },
                    { label: "Tasks Running", value: "3", color: "violet" },
                    { label: "Pending Approvals", value: "2", color: "amber" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-white/5 bg-white/3 p-3">
                      <div className="text-[10px] text-white/30 mb-1">{stat.label}</div>
                      <div className="text-xl font-bold text-white">{stat.value}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { name: "Alex Vance", role: "AI CTO", status: "Working", color: "bg-blue-500" },
                    { name: "Sarah Jenkins", role: "AI Support Agent", status: "Active", color: "bg-emerald-500" },
                    { name: "Morgan Chase", role: "AI Chief of Staff", status: "Waiting", color: "bg-purple-500" },
                  ].map((emp) => (
                    <div key={emp.name} className="flex items-center gap-2 p-2 rounded-lg border border-white/5 bg-white/2">
                      <div className={`w-6 h-6 rounded-full ${emp.color} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white truncate">{emp.name}</div>
                        <div className="text-[10px] text-white/30">{emp.role}</div>
                      </div>
                      <div className="text-[10px] text-white/40 shrink-0">{emp.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Employee Roles */}
      <section id="employees" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Your entire team, automated</h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Hire AI employees across every function of your business. Each one understands context, uses your tools, and asks before taking sensitive actions.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "🏗️", role: "AI CTO", desc: "Architecture, code review, tech debt, deployments" },
              { icon: "💻", role: "AI Engineer", desc: "Feature work, bug fixes, PRs, test coverage" },
              { icon: "🎧", role: "AI Support Agent", desc: "Email triage, knowledge search, reply drafting" },
              { icon: "📈", role: "AI Sales Assistant", desc: "Lead research, outreach drafts, CRM updates" },
              { icon: "📋", role: "AI Chief of Staff", desc: "Deadline tracking, cross-team coordination" },
              { icon: "🗺️", role: "AI Product Manager", desc: "Roadmap planning, spec writing, Linear issues" },
              { icon: "💰", role: "AI Finance Assistant", desc: "Stripe monitoring, billing reports, alerts" },
              { icon: "⚙️", role: "AI Ops Manager", desc: "Runbooks, incident response, process docs" },
            ].map((e) => (
              <div key={e.role} className="group rounded-xl border border-white/8 bg-white/3 p-4 hover:border-white/15 hover:bg-white/5 transition-all cursor-default">
                <div className="text-2xl mb-3">{e.icon}</div>
                <div className="font-semibold text-sm mb-1">{e.role}</div>
                <div className="text-xs text-white/40 leading-relaxed">{e.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">AI employees that work together</h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Assign a goal to your team and watch your AI employees coordinate across tools, handoff tasks, and keep you in the loop.
            </p>
          </div>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 to-violet-500/10" />
            {[
              { actor: "You", action: `"Prepare the onboarding launch for next Friday."`, color: "bg-white text-black" },
              { actor: "AI PM", action: "Reads product context and creates the launch plan spec in Notion", color: "bg-violet-500" },
              { actor: "AI CTO", action: "Reviews infra requirements, creates 4 Linear tasks for engineering", color: "bg-blue-500" },
              { actor: "AI Engineer", action: "Implements tasks, opens PRs on GitHub branch", color: "bg-cyan-500" },
              { actor: "AI Chief of Staff", action: "Tracks deadlines, posts daily summaries to Slack #launches", color: "bg-amber-500" },
              { actor: "AI Support", action: "Writes customer-facing changelog and FAQ doc in Notion", color: "bg-emerald-500" },
              { actor: "Clone", action: "Approval request sent to you before any external email is sent →", color: "bg-orange-500" },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4 mb-6 relative pl-12">
                <div className={`absolute left-3.5 top-1 w-5 h-5 rounded-full ${step.color} flex items-center justify-center text-[10px] font-bold shrink-0 -translate-x-1/2`}>
                  {i + 1}
                </div>
                <div className="flex-1 border border-white/8 rounded-xl p-4 bg-white/2">
                  <div className="text-xs text-white/40 mb-1">{step.actor}</div>
                  <div className="text-sm text-white/80">{step.action}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Connected to your real tools</h2>
          <p className="text-white/50 max-w-xl mx-auto mb-12">
            Your AI employees authenticate with OAuth, use real APIs, and only access what you permit.
            No data silos. No copy-paste.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {["GitHub", "Slack", "Gmail", "Notion", "Linear", "Google Calendar", "HubSpot", "Stripe", "Intercom", "Vercel", "Sentry", "Discord", "Zendesk", "E2B"].map((app) => (
              <div key={app} className="px-4 py-2 rounded-full border border-white/10 bg-white/4 text-sm text-white/60 hover:border-white/20 hover:text-white/80 transition-all">
                {app}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">You stay in control. Always.</h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Clone doesn't act without permission. Every sensitive action — sending email, merging PRs, financial operations — requires explicit human approval.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "🔐",
                title: "Role-based permissions",
                desc: "Configure exactly what each AI employee can read, write, send, or deploy. Separate permission scopes per integration.",
              },
              {
                icon: "✅",
                title: "Human approval gates",
                desc: "Critical and high-risk actions pause and wait for explicit founder approval before execution.",
              },
              {
                icon: "📋",
                title: "Full audit trail",
                desc: "Every action, tool call, approval, and decision is recorded with actor, timestamp, IP, and metadata.",
              },
              {
                icon: "🏢",
                title: "Multi-tenant isolation",
                desc: "Companies are fully isolated. No data can leak between organizations at any layer.",
              },
              {
                icon: "🔒",
                title: "Encrypted credentials",
                desc: "All OAuth tokens are encrypted at rest with AES-256-GCM. Tokens never reach the browser.",
              },
              {
                icon: "🛡️",
                title: "OWASP compliant",
                desc: "Built with injection protection, CSRF tokens, secure cookies, strict CSP headers, and SSRF-safe fetching.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-white/8 bg-white/3 p-5">
                <div className="text-2xl mb-3">{item.icon}</div>
                <div className="font-semibold text-sm mb-2">{item.title}</div>
                <div className="text-xs text-white/40 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently asked</h2>
          <div className="space-y-6">
            {[
              { q: "Is Clone a cloud IDE?", a: "No. Clone is an AI employee and company operating system. Cloud development environments like Codespaces, Daytona, E2B, or Coder are available as optional integrations for engineering AI employees — not the core product." },
              { q: "Can AI employees take actions autonomously?", a: "Yes, within their permission boundaries. You define what each employee can do, and sensitive or high-risk actions are always held for human approval before they execute." },
              { q: "How are my OAuth credentials stored?", a: "All OAuth access tokens are encrypted server-side using AES-256-GCM before storage. They never touch the browser or frontend at any point. You can revoke access at any time." },
              { q: "What LLM providers does Clone use?", a: "Clone is provider-neutral. It supports OpenAI GPT-4o and Anthropic Claude out of the box, with an extensible adapter pattern for custom LLM gateways." },
              { q: "Can AI employees talk to each other?", a: "Yes. Employees can delegate sub-tasks to teammates, share memory scopes, and coordinate via workflows. The AI Chief of Staff role is specifically designed for cross-team orchestration." },
            ].map((item) => (
              <details key={item.q} className="group border border-white/8 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium hover:bg-white/3 transition-colors list-none">
                  {item.q}
                  <span className="text-white/30 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-white/50 leading-relaxed border-t border-white/5 pt-4">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Start building your AI company</h2>
          <p className="text-white/50 mb-8">Free to start. No credit card required. Create your first AI employee in under 3 minutes.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-white font-semibold hover:opacity-90 transition-all hover:scale-[1.02] shadow-xl shadow-blue-500/25"
          >
            Create your AI company →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-violet-600" />
            <span className="text-sm font-medium">Clone</span>
          </div>
          <div className="text-xs text-white/30">
            © 2026 Clone AI Inc. All rights reserved.
          </div>
          <div className="flex gap-4 text-xs text-white/30">
            <a href="#" className="hover:text-white/60 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/60 transition-colors">Terms</a>
            <a href="#" className="hover:text-white/60 transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
