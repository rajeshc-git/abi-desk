# 🌟 ABI Desk — Non-Technical User & Complete Feature Guide

_A beginner-friendly visual guide to exploring every single feature of your enterprise customer support platform._

---

## 🗺️ 1. Platform Overview & How Everything Connects

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 1. WEBSITE VISITORS & CUSTOMERS                                 │
│                                                                                                 │
│   Customer on Website ──► Floating Support Widget ──► Takes Screenshot / Records Screen Video   │
│                                                   ──► Starts Real-Time Live Chat with Agent     │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             2. SUPPORT AGENT CONSOLE (localhost:9999)                           │
│                                                                                                 │
│  [📥 Ticket Inbox]  ──► L1 Frontline reviews & sends Public Replies or 🔒 Private Notes         │
│                     ──► L2 Technical inspects Browser Error Logs & watches Screen Videos        │
│                     ──► L3 Product Lead handles Escalations & Change Approvals                  │
│                     ──► Developers fix code bugs & QA Team verifies resolution                  │
│                     ──► Customer receives confirmation & Ticket closes cleanly                  │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                3. MANAGEMENT & GOVERNANCE CENTER                                │
│                                                                                                 │
│  [🏢 Admin Portal]  ──► Invite Staff Teammates by real Email (Office 365)                        │
│                     ──► Customize Brand Logos, Primary Colors & Widget Embed Codes              │
│                     ──► Executive Analytics (First Response Time, CSAT 4.8★, SLA Compliance)    │
│                     ──► GDPR & Data Privacy (Art. 15 Exports & Art. 17 In-Place Erasure)        │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ 2. Getting Started in 30 Seconds

1. Open your web browser and navigate to:  
   👉 **[http://localhost:9999/register](http://localhost:9999/register)**

2. Register your organization by entering your Company Name, Full Name, Work Email, and Password.

3. Click **"Register & Create Organization"** — your account is created, a welcome email is sent to your inbox via Office 365, and you are logged into your new console immediately!

---

## 🎯 3. Complete Feature-by-Feature Exploration Guide

```
                      ┌─────────────────────────────────────────┐
                      │        Log in to localhost:9999         │
                      └────────────────────┬────────────────────┘
                                           │
         ┌──────────────────┬──────────────┴─────┬──────────────────┬─────────────────┐
         │                  │                    │                  │                 │
         ▼                  ▼                    ▼                  ▼                 ▼
   [🏢 Admin]       [🎧 L1 Frontline]    [🛠️ L2 Technical]     [💬 Live Chat]     [📊 Executive]
   Admin Center,     Inbox Triage,        Diagnostics Logs,     Real-Time Stream,  KPI Scorecards,
   User Invites &    Public & Private     Video Player &        1-Click Ticket     CSAT Ratings &
   Brand Settings    Team Notes           Escalations           Promotion          CSV Exports
```

---

### 📥 Feature Area 1: Ticket Inbox & Triage Desk (`/inbox`)

_The primary workspace for handling incoming customer requests._

- 🔍 **Top Search Bar (Ctrl+K)**: Instant full-text search across ticket subjects, customer names, and tags.
- 🗂️ **Queue Filter Tabs**: Switch between **All Open**, **My Tickets** (assigned to you), **Escalated**, and **Resolved**.
- ➕ **"+ New Ticket" Modal**:
  - Click **"+ New Ticket"** in the top toolbar.
  - Fill in Subject, Customer Full Name, Email, Priority (`Low`, `Normal`, `High`, `Urgent`, `Critical`), Type (`Incident`, `Problem`, `Change Request`), Support Tier (`L1`, `L2`, `L3`, `Dev`, `QA`), and Tags.
  - The ticket appears instantly in the queue.
- ☑️ **Bulk Actions Toolbar**:
  - Click the checkbox on any ticket card to select multiple tickets.
  - An amber bulk toolbar will slide in with **"Assign to Me"** and **"Close Selected"** actions.
- 📄 **Split-Pane Quick View**: Click any ticket on the left to see its instant summary, description, and requester info on the right without leaving your inbox.

---

### 💬 Feature Area 2: Ticket Conversation & Resolution Workspace (`/tickets/:id`)

_Where support staff communicate, investigate, and solve issues._

- ⏱️ **Live SLA Clocks with Smart Auto-Pause**:
  - Located at the top of the ticket workspace.
  - **First Response SLA** and **Resolution SLA** timers show live countdowns (e.g. `2h 15m left`).
  - **Smart Pause**: If you switch the status dropdown to **"Pending Customer"**, the clock automatically changes to **"Paused (Waiting on Customer)"** so your team is never penalized while waiting for customer replies!
- 📝 **Dual-Mode Reply Composer**:
  - 🌐 **Public Reply**: Messages sent directly to the customer's email inbox.
  - 🔒 **Private Internal Note**: Toggle to the **"Internal Note"** tab (turns amber/yellow). Write private messages, debugging tips, and handover notes for teammates — completely invisible to the customer.
- 🔄 **Status Transition Dropdown**:
  - Move tickets between `Open`, `In Progress`, `Pending Customer`, `Escalated`, `Resolved`, and `Closed`.
- 🔼 **Tier Escalation Dropdown**:
  - Escalate tickets with 1 click to `L1 Frontline`, `L2 Technical`, `L3 Product`, `Dev Engineering`, or `QA Team`.
- 👤 **"Assign to Me" Action**: 1-click button to take ownership of an unassigned ticket.

---

### 🔍 Feature Area 3: Client Telemetry & Diagnostics Inspector (The Bug Detective)

_Automatically collected technical metadata so engineers never have to ask "What browser are you using?"._

- 🖥️ **Device & Platform Card**:
  - Customer's exact Browser Name & Version, Operating System, Device Type, Pixel Ratio, and Screen/Viewport Resolution.
  - The exact Page URL and Referrer where the bug occurred.
- 📟 **Console Logs Terminal**:
  - A formatted, syntax-highlighted terminal showing the customer's `console.log`, `console.warn`, and `console.error` traces.
  - Includes timestamping and a 1-click **"Copy All"** button.
- 📡 **Network Requests Inspector**:
  - A clean table listing all API calls made by the customer's page, their HTTP Status Codes (`200 OK`, `404`, `500`), and response latencies in milliseconds.
- 🚨 **JavaScript Error Stack Traces**:
  - Detailed stack trace cards showing the exact line of code that caused a frontend crash.

---

### 🎬 Feature Area 4: In-Browser Media Player & Screen Recordings

_Watch and listen to customer issues directly in your browser._

- 🎥 **WebM Screen Video Player**: Built-in video player with timeline scrubber and controls to watch the customer's screen recording.
- 🎙️ **Voice Notes Player**: Built-in audio waveform player to listen to customer voice explanations.
- 🖼️ **Annotated Screenshot Viewer**: High-resolution zoomable lightbox to inspect customer screenshot drawings, arrows, and redactions.

---

### ⚡ Feature Area 5: Real-Time Live Chat Desk (`/chat`)

_Real-time bi-directional messaging with website visitors._

- 🟢 **Live Socket.IO Gateway**: Green connection indicator showing real-time connectivity.
- 👥 **Active Chat Queue**: See incoming website visitors waiting for support.
- 💬 **Live Stream**: Instant bi-directional chat with visitor origin page URLs.
- 🎫 **1-Click "Promote to Ticket"**: Convert any active chat conversation into a permanent support ticket in 1 click, automatically copying the full chat transcript into the ticket timeline!

---

### 📊 Feature Area 6: Executive Analytics & SLA Performance (`/analytics`)

_Visual scorecards and benchmarks for management and team leads._

- 📈 **KPI Scorecards**:
  - **Total Tickets**: Complete ticket volume.
  - **Open Backlog**: Active in-progress workload.
  - **SLA Compliance Rate**: Team performance against target (e.g. 92%).
  - **Avg First Response Time**: How fast your team answers customers.
  - **CSAT Satisfaction Rating**: Overall customer satisfaction score (e.g. 4.8 / 5.0 ★).
- 📊 **Support Tier Distribution**: Visual progress bars showing volume across L1, L2, L3, and Dev.
- 🏆 **Agent Performance Leaderboard**: Ranking of agents by tickets resolved and average handle times.
- 💾 **1-Click Export Engine**: Download complete data spreadsheets with the **"Export CSV"** and **"Export JSON"** buttons.

---

### ⚙️ Feature Area 7: Tenant Administration Center (`/admin`)

_Everything company managers configure to run their support operations._

- 🏷️ **Brands & Multi-Brand Switcher**:
  - Manage multiple products and subsidiaries from one single helpdesk.
  - Switch active brands on the fly from the top header dropdown.
- 💻 **Embeddable Widget SDK Hub**:
  - View widget capabilities (screenshot drawing, screen video/voice recording, live chat).
  - 1-click **"Copy Code Snippet"** button to copy the `<script>` embed tag for any external website.
- 👥 **Teams & Routing Queues**:
  - View frontline, technical, product, and engineering teams with smart routing strategies (`Round Robin`, `Least Loaded`, `Manual`).
- ✉️ **Staff User Roster & Real Email Invites**:
  - View all staff members, their roles, and active statuses.
  - Click **"+ Invite New Staff"** to send real email invitations via Office 365.
- 🗝️ **Server API Keys (Argon2id)**:
  - Generate secure server-to-server API keys (`abidesk_live_`) with raw key copy protection.
- 📡 **Outbound Webhooks (HMAC-SHA256)**:
  - Configure webhook endpoints and test deliveries with secure HMAC signatures.
- ⚖️ **GDPR & DPDPA Compliance Tools**:
  - 1-click **Art. 15 Personal Data Exports** and **Art. 17 In-Place PII Anonymization** purge tools.

---

### 🌐 Feature Area 8: Customer-Facing Embeddable Widget (`@abi-desk/widget`)

_The floating support bubble embedded on your customer's website._

- 📸 **Screenshot Drawing & Redactions**: Snap the page and draw red arrows, boxes, text labels, or blackout sensitive passwords/credit cards before sending.
- 🎬 **Screen Video Recorder**: Record a live video of the screen showing the bug in action.
- 🎙️ **Voice Notes Recorder**: Speak into the microphone to explain the problem.
- 🕵️ **Automatic Error Collector**: Captures console logs, network errors, and device specs automatically in the background.
- 💬 **Live Chat Window**: Direct real-time chat with support agents.

---

## 🌐 4. Quick Port & Services Cheat Sheet

| Service                        | Browser Link                     | Purpose                                     |
| ------------------------------ | -------------------------------- | ------------------------------------------- |
| 🖥️ **Agent Web Console**       | **`http://localhost:9999`**      | Support Agents, Leads, and Administrators   |
| 📖 **API Documentation**       | **`http://localhost:4000/docs`** | Interactive Swagger API Testing & Contracts |
| 📬 **Mailbox Relay (Mailpit)** | **`http://localhost:8025`**      | Viewing outgoing email previews locally     |
| 🪣 **MinIO File Storage**      | **`http://localhost:9001`**      | Direct S3 attachments and screen recordings |

---

## 🔑 5. Fresh Account & Staff Registration

No pre-filled dummy accounts are hardcoded in the system. The platform operates on a 100% fresh self-service registration model:

1. **Register Your Organization**:
   - Go to **`http://localhost:9999/register`**.
   - Enter your Company / Organization Name, Full Name, Work Email, and Password.
   - Click **"Register & Create Organization"**.
   - You will receive a **welcome confirmation email** via Office 365 SMTP, and your account will automatically be granted full **Tenant Administrator** authority.

2. **Invite Teammates & Support Staff**:
   - Inside your console, go to **Tenant Admin (`/admin`) &rarr; User Roster**.
   - Click **"+ Invite New Staff"**.
   - Enter your teammate's name and email, and choose their role (`L1 Support`, `L2 Support`, `L3 Support`, `Dev Team`, `QA Team`, `Admin`).
   - Click **Send Email Invite** — a secure email invitation with join credentials will be dispatched to them automatically!
