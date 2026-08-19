# 🏢 ABI Desk — Enterprise Customer Support & Helpdesk Platform

_(A Complete, Multi-Tenant Support SaaS — Like Zoho Desk / Zendesk)_

---

## 📖 What is this Project?

**ABI Desk** is a complete, enterprise-grade customer support platform. It bridges the gap between **customers facing issues on a website** and the **support team, engineers, and managers who solve them**.

It consists of three interconnected systems:

1. 🌐 **The Customer Support Widget** (The floating bubble on your website for submitting tickets, recording screen videos, and live chatting).
2. 🖥️ **The Support Agent Console** (The human web portal where support agents triage tickets, write team notes, inspect error logs, and chat live).
3. ⚙️ **The Management & Admin Center** (Where business owners configure brand colors, invite staff by email, and view analytics).

---

## 👥 1. User Roles & What They Do

| Role                    | Who is this?                  | What can they do?                                                                                     |             Completed             |
| ----------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- | :-------------------------------: |
| **👤 Guest / Customer** | Website visitors & app users  | Create tickets, record screen/voice, chat with agents, view their own tickets                         |  **[x] Done** _(Widget + Auth)_   |
| **🏢 Tenant Admin**     | Company managers & IT admins  | Configure brand colors, invite staff members, view all tickets, manage API keys & webhooks            |   **[x] Done** _(Admin Portal)_   |
| **🎧 L1 Support Team**  | Frontline support agents      | First-response inbox triage, public replies to customers, private internal team notes                 |  **[x] Done** _(Agent Console)_   |
| **🛠️ L2 Support Team**  | Technical support specialists | Investigate technical issues, inspect browser error logs, watch customer screen recordings            | **[x] Done** _(Diagnostics Hub)_  |
| **🔬 L3 Support Team**  | Product specialists & leads   | Handle advanced product escalations and approve high-impact change requests                           | **[x] Done** _(Approvals Engine)_ |
| **💻 Development Team** | Software engineers            | Receive verified bug tickets with stack traces, write internal engineering notes, resolve code issues |  **[x] Done** _(Dev Workspace)_   |
| **🧪 QA Team**          | Quality assurance testers     | Test and verify bug fixes before marking issues as resolved                                           |     **[x] Done** _(QA Stage)_     |
| **🛡️ Platform Admin**   | SaaS hosting operations       | Vendor-level platform maintenance and multi-tenant security operations                                |  **[x] Done** _(Platform Scope)_  |

---

## 🧩 2. Customer Support Widget Features

The floating support launcher on customer websites gives users powerful tools to explain their problem instantly:

- [x] **Create Support Tickets** — Simple form to submit an issue with title, description, and category. _(Widget + API)_
- [x] **Capture Screenshots** — Take a snapshot of the current page with 1 click. _(Widget Screen Capture)_
- [x] **Annotate Screenshots** — Interactive drawing studio with pen drawing, arrows, rectangles, text labels, and blackout redaction tools to hide passwords/private data. _(Canvas Studio)_
- [x] **Record Screen Video** — Record a high-quality video of the problem happening on screen. _(WebM Video Recorder)_
- [x] **Record Voice Notes** — Speak into the microphone to explain the problem in plain words. _(Audio Recorder)_
- [x] **Upload Attachments** — Direct file uploader with automatic security validation. _(S3 Direct Upload)_
- [x] **Automatic Error Detective** — Automatically bundles browser name, OS, screen size, website URL, console logs, and network API errors so developers don't have to ask questions. _(Telemetry Ingestion)_
- [x] **Real-Time Live Chat** — Chat live with a human support agent directly inside the widget. _(Socket.IO Chat Gateway)_

---

## 📊 3. Role Permissions & Access Matrix

A clear breakdown of what each role is allowed to do in the platform:

| Feature / Action                   | Guest |   Tenant Admin    |   L1 Frontline    | L2 Technical | L3 Product | Dev Team | QA Team |  Completed   |
| ---------------------------------- | :---: | :---------------: | :---------------: | :----------: | :--------: | :------: | :-----: | :----------: |
| **Create Ticket**                  |  ✅   |        ✅         |        ✅         |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |
| **Edit Own Ticket**                |  ✅   |        ✅         |        ✅         |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |
| **View Own Tickets**               |  ✅   |        ✅         |        ✅         |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |
| **View All Company Tickets**       |  ❌   |        ✅         |        ✅         |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |
| **🔒 Private Internal Team Notes** |  ❌   |   ❌ _(Admin)_    |        ✅         |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |
| **Capture Screenshot & Draw**      |  ✅   |        ✅         |        ✅         |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |
| **Record Screen Video & Voice**    |  ✅   |        ✅         |        ✅         |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |
| **Assign Tickets**                 |  ❌   |  🏷️ _Queue Only_  |        ✅         |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |
| **Escalate Ticket Tier**           |  ❌   | ⚙️ _Configurable_ |        ✅         |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |
| **Close Ticket**                   |  ❌   | ⚙️ _Configurable_ |        ✅         |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |
| **Bulk Update Tickets**            |  ❌   |        ❌         | ⚙️ _Configurable_ |      ✅      |     ✅     |    ✅    |   ✅    | **[x] Done** |

---

## ⚙️ 4. Tenant Administration & Management

Everything an organization administrator can configure from the **Admin Center** (`/admin`):

- [x] **Manage Staff & Roles** — View your complete team directory and assign support roles. _(User Roster)_
- [x] **Invite New Teammates by Email** — Send real email invitations via Office 365 with 1-click joining links. _(Email Mailer)_
- [x] **Widget Styling & Embed Code** — Customize widget colors, theme, and copy-paste the 1-line HTML embed code. _(Widget Hub)_
- [x] **Multi-Brand Management** — Run multiple products or subsidiary brands from one single helpdesk. _(Brands Center)_
- [x] **Single Sign-On (SSO)** — Log in via Google, Microsoft, Okta, or corporate SAML 2.0. _(SSO Provider)_
- [x] **SLA Business Hours & Shifts** — Set up business hours schedules, timezones, and official holiday calendars. _(SLA Engine)_
- [x] **Automation Rules** — Automatic triggers and actions (e.g. auto-assign urgent billing tickets to L2). _(Automation Engine)_
- [x] **Server API Keys** — Generate secure server keys for automated backend integrations. _(Argon2id Keys)_
- [x] **Outbound Webhooks** — Send real-time notifications to external systems with secure signatures. _(HMAC Webhooks)_

---

## 🔍 5. Automatically Captured Diagnostics

When a customer submits a ticket, the system automatically captures technical details to make debugging effortless:

- [x] **Browser & OS Information** — Chrome, Firefox, Safari, Windows, macOS, Linux, iOS, Android. _(Device Collector)_
- [x] **Device & Screen Specs** — Screen resolution, window size, device pixel ratio. _(Display Inspector)_
- [x] **Page URL & Referrer** — The exact page where the bug happened and where the user came from. _(Navigation Tracker)_
- [x] **Console Logs Terminal** — Live ring buffer of `console.log`, `warn`, and `error` messages with instant search. _(Terminal Viewer)_
- [x] **Network Requests Table** — List of all API calls made by the page, including HTTP status codes and latency. _(Network Inspector)_
- [x] **JavaScript Error Tracebacks** — Stack traces showing the exact code line that caused a crash. _(Error Tracer)_
- [x] **Screen Recordings & Media** — In-browser video player for screen recordings and audio waveform player for voice notes. _(Media Player)_

---

## 🔄 6. Complete Ticket Lifecycle Workflow

How an issue travels through the team from start to finish:

```
┌──────────┐      ┌────────────┐      ┌────────────┐      ┌────────────┐      ┌─────────────┐      ┌─────────┐
│ Customer │ ───► │ L1 Support │ ───► │ L2 Support │ ───► │ L3 Product │ ───► │ Development │ ───► │ QA Team │ ───► Resolved / Closed
└──────────┘      └────────────┘      └────────────┘      └────────────┘      └─────────────┘      └─────────┘
```

- [x] **Multi-Tier Status Transitions** — Move tickets seamlessly between `Open`, `In Progress`, `Pending Customer`, `Escalated`, `Resolved`, and `Closed`. _(Workflow State Machine)_
- [x] **Live SLA Timer with Smart Auto-Pause** — Clocks countdown to ensure quick replies; **automatically pauses** when waiting for the customer to reply so agents aren't unfairly penalized. _(SLA Clocks)_
- [x] **Customer Resolution Confirmation** — Once resolved, the customer confirms the fix before final closure. _(Confirmation Gate)_

---

## 🏆 7. Enterprise SaaS Features

- [x] **Row-Level Database Security (RLS)** — Complete data isolation between different client companies at the database kernel level. _(PostgreSQL 17)_
- [x] **Live SLA Management** — Automatic tracking of First Response and Resolution time targets. _(SLA Calculator)_
- [x] **Approval Workflows** — Two-person sign-off gates for high-impact changes. _(Approvals)_
- [x] **Tamper-Proof Audit Trail** — Append-only audit history of every status change, assignment, and note. _(Audit Log)_
- [x] **Live Chat to Ticket Promotion** — Convert any active live chat conversation into a permanent ticket with 1 click. _(Chat Desk)_
- [x] **Executive Analytics Dashboard** — Real-time scorecards for response times, CSAT satisfaction ratings, volume trends, and 1-click CSV/JSON exports. _(Analytics Portal)_
- [x] **GDPR & Privacy Compliance** — 1-click Personal Data Exports (Art. 15) and In-place PII Anonymization (Art. 17). _(Privacy Hub)_

---

### 🌐 Quick Access Links

- 🖥️ **Human Support Agent Console**: [http://localhost:9999](http://localhost:9999)
- 📖 **Interactive API Documentation**: [http://localhost:4000/docs](http://localhost:4000/docs)
- 📬 **Real-time Email Viewer (Mailpit)**: [http://localhost:8025](http://localhost:8025)
- 🪣 **S3 Media Storage Console**: [http://localhost:9001](http://localhost:9001)
