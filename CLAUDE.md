# CLAUDE.md — Project Context for Claude Code

This file exists so a new Claude Code session can pick up this project with full
context. Read this before making changes.

## What this project is

A take-home performance task for a Senior Software Engineer application at the
**Modern Classrooms Project** (an educational technology nonprofit). The task PDF
(`MCP_Performance_Task_-_Software_Engineer.pdf`, not included in this repo — ask
Missa if you need it again) asked for a demo "Interactive Video Annotation
Platform": students watch videos with teacher-added annotations (questions, notes)
that appear at specific timestamps; teachers can add videos and annotations from an
admin view with no auth required.

**Full requirements and evaluation criteria are also summarized in
`README.md`** — read that too, it covers the architecture and trade-offs
already made.

## Who's using this / how to talk to me (the person, not the AI)

- My name is Missa (Melissa Freundschuh-Pula). I'm a full-stack developer
  (Angular/TypeScript-heavy, NestJS backend experience) applying for remote
  Senior Software Engineer roles.
- I want honest, direct help — flag problems, don't just tell me things look good
  when they don't.
- This submission is being evaluated on: code quality, Angular proficiency, RxJS
  mastery, integration skill, UX, and problem-solving. RxJS mastery is the
  centerpiece — don't simplify the reactive playback-time/annotation-triggering
  logic in `video-player.ts` into something naive (e.g. a plain `setInterval`)
  without a good reason; that logic is the main thing being evaluated.

## Current status (as of hand-off)

**Done:**
- Angular 22 app scaffolded (standalone components, signals, lazy-loaded routes),
  matching the task's ask exactly — see the Node version note immediately below
  before running anything.
- Student flow: `/videos` (list) → `/videos/:id` (player with YouTube IFrame API +
  RxJS-driven annotation overlay for multiple-choice, fill-in-blank, and note
  annotation types).
- Admin flow: `/admin` (dashboard, add video by YouTube link) →
  `/admin/videos/:id` (add/remove checkpoints on that video).
- Data layer: `VideoLibrary` service (`src/app/core/services/video-library.ts`),
  `BehaviorSubject`-backed, persists to `localStorage`, seeded with 2 demo videos.
- `npm run build` passes. `npm test` passes — 34 tests across `video-library.spec.ts`
  (CRUD, sorting, localStorage persistence/fallback, `extractYoutubeId` edge cases)
  and `video-player.spec.ts` (checkpoint triggering per annotation type,
  pause-on-checkpoint, one-checkpoint-at-a-time, rewind re-triggering, answer
  grading), plus the original app-shell smoke test.
- **Manual QA in an actual browser** (done via Claude Code's browser tool): played
  a video end to end, triggered all three annotation types, verified
  correct/incorrect answer feedback, rewind-retriggers behavior, admin add-video →
  manage-checkpoints → add/remove checkpoint flow, and the video-not-found route.
  This QA pass caught a real bug — see below.
- **Git initialized and pushed to GitHub**: https://github.com/melissapula/mcp-video-annotator
  (public).
- **Deployed to Netlify**: https://mcp-video-annotator.netlify.app (see
  `netlify.toml` for build/publish config and the SPA redirect rule that keeps
  deep links like `/videos/:id` working on a hard reload).

**Bug found and fixed during manual QA:** `video-player.ts` originally used
`@ViewChild('playerEl', { static: true })`, but that div lives inside
`*ngIf="video$ | async as video"` in the template — it doesn't exist in the DOM at
static-query resolution time, so `playerElRef` was always `undefined` and the
YouTube player never initialized (blank black box, console error). Fixed by
replacing it with a signal-based `viewChild()` query, converted to an observable via
`toObservable()` (declared as a field initializer, since `toObservable` requires an
injection context) and combined with the video and YouTube-API streams via
`combineLatest`. This is arguably a better fit for the RxJS-centric evaluation
criteria than the static query it replaced.

**Video walkthrough:** recorded and linked at the top of `README.md`
(youtube.com/watch?v=k0FCOAXiDuE). Submission is fully complete.

## Node version — read this before running any npm/ng command

Angular 22 requires Node `^22.22.3`, `^24.15.0`, or `>=26.0.0` (see `.nvmrc` /
`package.json`'s `engines` field for the exact pin). The machine this was built on
has a global Node `24.13.1` install (from the official installer, at
`C:\Program Files\nodejs`) that's just below the cutoff — `npm start`/`npm test`/
`npm run build` will hard-fail with "The Angular CLI requires a minimum Node.js
version..." if run against it directly.

`nvm-windows` is installed and was used to install `24.19.0`
(`C:\Users\missa\AppData\Roaming\nvm\v24.19.0\`), but `nvm use 24.19.0` fails even
elevated ("directory is not empty") because the existing global Node isn't an
nvm-managed symlink — deleting/replacing it wasn't attempted since it's outside
this project's scope and could affect other things on the machine. **Don't try to
force that fix without asking Missa first.**

The working approach, every session, before running `npm`/`ng` commands directly
(the Bash/PowerShell tools reset shell state between calls, so this needs
repeating per command or per script):

```powershell
$env:PATH = "C:\Users\missa\AppData\Roaming\nvm\v24.19.0;" + $env:PATH
npm start   # or npm test / npm run build
```

Netlify's own build doesn't need this — it reads `.nvmrc` and picks a compatible
Node version automatically.

## Key architectural decisions (already made — don't relitigate without reason)

- **YouTube link only, no file upload.** The task allowed either; link-only was
  chosen to avoid needing video storage/hosting infra, keeping the demo focused on
  the Angular/RxJS work being evaluated.
- **Hand-rolled YouTube IFrame API wrapper, not a third-party Angular video
  library** (e.g. not `ngx-videogular`, not `videojs-quiz`). This was deliberate —
  the point of the assessment is to demonstrate RxJS skill, and delegating the
  interactivity to a plugin would undercut that.
- **No auth**, per the task PDF's explicit note that this is acceptable for a demo.
- **localStorage persistence**, not a real backend — reasonable for a demo; would
  need a real API/DB for production.

## File map

```
src/app/
  core/
    models/video.model.ts          # Video, Annotation types
    services/video-library.ts      # BehaviorSubject-backed CRUD + localStorage
    services/video-library.spec.ts
    services/youtube-api-loader.ts # Lazy-loads the YT IFrame API script once
  features/
    student/
      video-list/                  # /videos
      video-player/                # /videos/:id — the RxJS centerpiece
      video-player/video-player.spec.ts
    admin/
      admin-dashboard/             # /admin
      video-editor/                # /admin/videos/:id
  shared/components/nav/           # top nav
  app.routes.ts
  app.ts / app.html / app.scss     # shell
netlify.toml                       # build/publish config + SPA redirect rule
```

## Commands

See the Node version section above first — these need Node `24.19.0` on the PATH.

```bash
npm install
npm start        # dev server, http://localhost:4200
npm run build    # production build
npm test         # unit tests (vitest via Angular CLI)
```
