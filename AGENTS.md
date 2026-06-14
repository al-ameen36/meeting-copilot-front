# Meeting Copilot — Frontend Codebase Guide

## Stack

- **Framework:** TanStack Start (SSR + file-based routing)
- **Router:** TanStack Router (file-based, auto-generated `routeTree.gen.ts`)
- **Data:** TanStack Query + Supabase (Postgres, Auth, Realtime)
- **UI:** React 19, Tailwind CSS v4, Framer Motion (`motion`)
- **Build:** Vite 8, Nitro (backend server)
- **Audio:** Web Audio API (`AudioContext`, `AudioWorklet`) + WebSocket

---

## Routing Map (File-Based)

| Route                           | File                                         | Purpose                                                        |
| ------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `__root`                        | `src/routes/__root.tsx`                      | Root shell — `AuthProvider`, devtools, CSS                     |
| `/`                             | `src/routes/index.tsx`                       | **Live Meeting** — start recording, live transcript + insights |
| `/login`                        | `src/routes/login.tsx`                       | Email/password login + signup via Supabase Auth                |
| `/meetings`                     | `src/routes/meetings/index.tsx`              | **Past Meetings** dashboard — grid of cards                    |
| `/meetings/$meetingId`          | `src/routes/meetings/$meetingId.tsx`         | **Meeting detail** — transcript, insights, chat                |
| `/api/meetings/$meetingId/chat` | `src/routes/api/meetings/$meetingId/chat.ts` | **Server route** — proxies chat queries to backend             |

---

## Feature Modules

### 1. Live Meeting (`/`)

- Custom `useWhisperStream()` hook manages real-time audio capture and transcription.
- Opens a WebSocket to `VITE_WHISPER_SERVER_URL`.
- Streams audio from **mic** or **tab capture** via an `AudioWorklet` (VocoderProcessor).
- Receives JSON messages over WS: `auth_ok`, `AddTranscript`, `AddPartialTranscript`, `Insight`.
- Handles partial transcripts, sentence completion (heuristic: ends with `.!?` or chunk >= 80 chars), and overlap removal.
- Creates a meeting in Supabase when the backend sends `auth_ok`.
- UI: scrolling transcript with "Live" indicator, real-time insights with type-based filters.
- Auth guard on client side: redirects unauthenticated users to `/login`.

### 2. Meeting Detail (`/meetings/$meetingId`)

- Server-side loader fetches meeting, segments, and insights from Supabase.
- Displays timestamped transcript segments in a scrollable pane.
- Displays filtered insights (important: `action_item`/`decision`/`risk`; general: `follow_up`/`update`).
- "Chat with Meeting" button opens a slide-over panel.
- **Insights array is currently always empty** — the Supabase query for insights is commented out (the filter column was wrong).

### 3. Past Meetings Dashboard (`/meetings`)

- Server-side loader fetches all meetings from Supabase, ordered by `created_at`.
- Grid of cards with title, date, duration, and links to detail page.
- "Start New Meeting" link navigates to `/` (live page).
- Sign-out button.

### 4. Chat with Meeting

- Slide-over panel (`ChatPanel`) with message history.
- Sends POST to `/api/meetings/$meetingId/chat` (server proxy → backend `/meetings/:id/chat`).
- Supports **SSE streaming** — reads response body chunk-by-chunk for streaming assistant responses.
- Renders assistant replies with `ReactMarkdown`.

### 5. Authentication

- `AuthProvider` wraps the app, syncs Supabase session via `onAuthStateChange`.
- Server-side route loaders check `supabase.auth.getSession()` and redirect to `/login`.
- Network availability indicator (red banner when offline).

### 6. Audio Pipeline

- `useWhisperStream` hook manages `AudioContext`, `AudioWorklet`, and WebSocket.
- Audio is chunked (16kHz sample rate) and streamed to a Whisper-like backend.
- Insights injected into UI in real-time as they arrive from the WS stream.

---

## Key Files

| File                                                | Role                                                    |
| --------------------------------------------------- | ------------------------------------------------------- |
| `src/router.tsx`                                    | Router creation + TanStack Query SSR integration        |
| `src/routes/__root.tsx`                             | Root route with `AuthProvider` wrapper                  |
| `src/lib/supabase.ts`                               | Supabase client singleton                               |
| `src/lib/utils.ts`                                  | `cn()` (clsx+twMerge) and `formatTime()`                |
| `src/features/auth/AuthContext.tsx`                 | `AuthProvider` + `useAuth()` hook                       |
| `src/features/meetings/meetings.data.ts`            | `getMeetings()` + `getMeetingDetail()` Supabase queries |
| `src/features/meetings/MeetingsDashboardPage.tsx`   | Dashboard UI                                            |
| `src/features/meetings/MeetingDetailPage.tsx`       | Detail page UI                                          |
| `src/features/live-meeting/LiveMeetingPage.tsx`     | Live meeting UI                                         |
| `src/features/live-meeting/useWhisperStream.ts`     | WebSocket + AudioWorklet hook                           |
| `src/features/transcript/TranscriptDisplay.tsx`     | Live transcript component                               |
| `src/features/chat/ChatPanel.tsx`                   | Slide-over chat UI                                      |
| `src/features/chat/chat.types.ts`                   | `ChatMessage`, `ChatRequestBody` types                  |
| `src/features/chat/chat.server.ts`                  | Shared server-side chat parsing utilities               |
| `src/components/StartButton.tsx`                    | Record/stop button with pulse animation                 |
| `src/components/SourceSelector.tsx`                 | Mic vs. Tab source selector                             |
| `src/components/InsightFilter.tsx`                  | (exists but unused — live page uses inline filters)     |
| `src/hooks/use-network.tsx`                         | `useNetwork()` — online/offline detection               |
| `src/types/transcripts.ts`                          | Shared `Meeting`, `Insight`, `Segment` types            |
| `src/integrations/tanstack-query/root-provider.tsx` | QueryClient context provider                            |
| `src/integrations/tanstack-query/devtools.tsx`      | React Query Devtools integration                        |

---

## What's Incomplete / Broken

1. **Insights never load.** Both `meetings.data.ts` and the detail page loader return `insights: []`. The detail page has the insights Supabase query commented out because the `segment_id` filter column was wrong.

2. **Import path mismatches** — Several files import from wrong paths:
   - `LiveMeetingPage.tsx` imports `useWhisperStream` from `#/hooks/use-stream` → should be `#/features/live-meeting/useWhisperStream`
   - `LiveMeetingPage.tsx`, `MeetingDetailPage.tsx` import `TranscriptDisplay` from `#/components/TranscriptDisplay` → should be `#/features/transcript/TranscriptDisplay`
   - `LiveMeetingPage.tsx`, `MeetingDetailPage.tsx` import `ChatPanel` from `#/components/ChatPanel` → should be `#/features/chat/ChatPanel`
   - `LiveMeetingPage.tsx` imports `InsightCard` from `#/components/InsightCard` → file doesn't exist (only in features)
   - `__root.tsx` imports `AuthProvider` from `#/contexts/AuthContext` → should be `#/features/auth/AuthContext`

3. **`InsightCard` component is missing** — No file at `components/InsightCard.tsx`. Needs to be created to display individual insights.

4. **Duplicate route definitions** — `meetings/index.tsx` and `meetings/$meetingId.tsx` both re-declare routes with `createFileRoute` while `routeTree.gen.ts` already has them. This suggests manual files were written after codegen, or the generator isn't in sync.

5. **Fragile meeting ID retrieval** — On WS `auth_ok`, the frontend fetches the latest meeting by `created_at`. This is racy if multiple meetings are created simultaneously.

6. **SSR auth in loaders** — Server-side route loaders use `supabase.auth.getSession()` directly, which may not work properly for SSR since auth cookies aren't automatically passed through.

7. **`InsightFilter.tsx` is unused** — File exists at `src/components/InsightFilter.tsx` but is never imported. The live page uses inline filter buttons instead.

---

## Architecture Diagram

```
Frontend (TanStack Start / Vite)
├── Client Routes (TanStack Router)
│   ├── /       → LiveMeetingPage (WS audio stream, live transcript, insights)
│   ├── /login  → Login form (Supabase Auth)
│   ├── /meetings → Dashboard (fetch meetings from Supabase)
│   └── /meetings/$id → Detail (segments, insights, chat)
│
├── Server Routes (Nitro)
│   └── /api/meetings/$id/chat → Proxy to backend LLM endpoint (SSE streaming)
│
├── Audio Pipeline
│   └── useWhisperStream hook
│       ├── Mic or Tab capture (MediaDevices API)
│       ├── AudioWorklet (16kHz vocoder processor)
│       └── WebSocket → Whisper backend server
│           ├── Sends: audio chunks + auth token
│           └── Receives: auth_ok, AddTranscript, AddPartialTranscript, Insight
│
├── Data Layer
│   ├── Supabase (Postgres: meetings, segments, insights tables)
│   └── TanStack Query (via SSR integration)
│
└── Shared Components
    ├── StartButton, SourceSelector, InsightCard
    ├── TranscriptDisplay, ChatPanel
    └── AuthProvider, useAuth, useNetwork
```

---

## Dev Notes

- **Codegen:** Run `pnpm dev` — TanStack Router's Vite plugin auto-generates `src/routeTree.gen.ts`. Do not edit this file manually.
- **Paths:** Uses `#/*` → `./src/*` import alias (defined in `package.json` `imports` field).
- **Env vars:** See `.env.example`. Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WHISPER_SERVER_URL`.
- **Backend:** The Whisper server runs separately (default `localhost:8000`). It handles real-time transcription and insight extraction.
- **Chat proxy:** The server route at `/api/meetings/$id/chat` forwards to the backend's chat endpoint and streams SSE responses back to the client.
