# Real-Time Collaborative Interview Platform

A live, multi-user coding interview platform: interviewers write a problem with test cases, candidates join a room and solve it in a synced code editor, and code executes in a sandboxed Piston runner with per-test-case pass/fail grading — all in real time, over WebSockets.

**Live demo:** [https://real-time-interview-platform-beta.vercel.app/] · **Backend:** [https://real-time-interview-platform.onrender.com]


---

## Why this project

Most "collaborative code editor" side projects stop at "two people can type in the same box." This one goes further: it's built around the actual shape of a technical interview — an interviewer authors a problem with hidden and visible test cases, a candidate is graded against them, and the system enforces who can see what. The interesting engineering problems here aren't in the UI — they're in making real-time state, untrusted code execution, and role-based data visibility all work correctly at the same time.

## Core features

- **Real-time collaborative editor** — Monaco-based, synced across all participants in a room via WebSockets, with debounced updates to avoid flooding the network on every keystroke
- **Sandboxed code execution** — user-submitted code (JavaScript & Python) is executed by a [Piston](https://github.com/engineer-man/piston) runner (self-hosted in Docker, or any compatible endpoint set via `PISTON_URL`), so it never runs on the main server or touches its credentials
- **Asynchronous execution via job queue** — "Run Code" requests go through a Redis-backed queue (BullMQ), processed by a BullMQ worker (embedded in the server process by default, or run separately with `RUN_WORKER=false` + `npm run worker`), and the actual execution happens on the Piston runner, so the main server's event loop never blocks while code runs
- **Interviewer/candidate roles** — the session creator is the interviewer, the first person to join is the candidate; each sees a different, purpose-built view of the same room
- **Problem authoring with hidden test cases** — interviewers write a problem description and a mix of visible and hidden test cases; candidates are graded against all of them but can only see the visible ones
- **Server-side data sanitization by role** — hidden test case data (input, expected output, actual output) is stripped on the server before it ever reaches a candidate's browser, both over WebSocket payloads and REST responses — not just hidden in the UI
- **Live presence & cursor tracking** — see who's in the room, and watch their cursor move in real time (throttled to a fixed rate to keep traffic sane)
- **In-room chat**
- **Session persistence** — code is auto-saved to MongoDB on a debounce, and reloaded automatically when someone rejoins a room; a "My Sessions" view shows session history per user
- **Full authentication** — JWT-based auth protecting both REST endpoints and the WebSocket connection itself (a custom Socket.io middleware verifies the token before a socket is allowed to join any room)
- **End-interview flow** — the interviewer can close out a session; the candidate is redirected out, and the interviewer keeps a read-only view of the final state

## Architecture

```
┌─────────────┐      WebSocket / REST       ┌──────────────────┐
│   React     │ ───────────────────────────▶│   Express +      │
│  (Vite,     │◀─────────────────────────── │   Socket.io      │
│  Tailwind)  │                              │   (main server)  │
└─────────────┘                              └────────┬─────────┘
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    ▼                   ▼                   ▼
                              ┌──────────┐        ┌──────────┐       ┌────────────┐
                              │ MongoDB  │        │  Redis   │       │  BullMQ    │
                              │ (users,  │        │ (queue   │       │  Worker    │
                              │ sessions,│        │  backing │       │  (separate │
                              │ problems)│        │  store)  │       │  process)  │
                              └──────────┘        └──────────┘       └─────┬──────┘
                                                                            │
                                                                            ▼
                                                                    ┌───────────────┐
                                                                    │ Piston runner  │
                                                                    │ (sandboxed     │
                                                                    │ code execution)│
                                                                    └───────────────┘
```

**Why a queue instead of running code directly on the main server?** Executing arbitrary code takes real time and can hang. If the main Node.js server ran it directly, one slow or malicious submission would freeze the event loop for *every* connected user — chat, cursor sync, everything. Instead, the server just enqueues a job and immediately goes back to serving requests; a BullMQ worker picks up jobs, sends them to the Piston runner, and the result is pushed back to the right room over WebSocket once it's ready.

**Why a separate runner for execution?** Running untrusted, user-submitted code with `eval` or a raw subprocess call would give that code full access to the host — its filesystem, environment variables, network. Submissions are instead sent to a Piston instance, which runs each one in an isolated sandbox with resource limits and a timeout. Piston runs separately from the app, so a malicious or broken submission can't reach the app's data.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), Tailwind CSS, Monaco Editor |
| Backend | Node.js, Express, Socket.io |
| Database | MongoDB (Mongoose) |
| Queue / Cache | Redis (Upstash), BullMQ |
| Code execution | Piston (self-hosted via Docker, or compatible API) |
| Auth | JWT (custom middleware for both REST and Socket.io) |
| Deployment | Vercel (frontend), Render (backend) |

## Getting started locally

**Prerequisites:** Node.js 18+, a MongoDB connection string, a Redis connection string, and a Piston endpoint for code execution (Docker needed only if you self-host Piston).

```bash
# Clone
git clone <repo-url>
cd real-time-interview-platform

# Backend
cd server
npm install
# create a .env file — see below
npm run dev      # starts the main server
npm run worker   # in a separate terminal — starts the execution worker

# Frontend
cd ../client
npm install
npm run dev
```

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`.

**Code runner (Piston):** the public `emkc.org` API now requires an authorization token. Easiest local setup:
```bash
docker run --privileged -dit -p 2000:2000 --name piston_api ghcr.io/engineer-man/piston
# install runtimes (needs the Piston CLI, see the Piston repo):
#   ppman install node 18.15.0 && ppman install python 3.10.0
```
then set `PISTON_URL=http://localhost:2000/api/v2/execute` in `server/.env`.

**`server/.env`**
```
MONGO_URI=
JWT_SECRET=
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
CLIENT_URL=http://localhost:5173
PISTON_URL=
```

Two terminals are enough in development: the server (which also runs the worker) and the frontend dev server.

## What I'd build next

- Support for more languages (compiled languages like Java/C++, which need a separate compile step before execution)
- Stronger rate limiting on code execution (currently one run per 3s per socket)
- WebRTC-based voice/video, for a fully self-contained interview experience
- Automated tests around the sanitization layer specifically, since that's the highest-stakes correctness boundary in the app

---

*Built as a solo project to go deep on real-time systems, background job processing, and sandboxed code execution — not just to ship a UI.*
