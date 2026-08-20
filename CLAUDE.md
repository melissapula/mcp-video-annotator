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
- Angular 21 app scaffolded (standalone components, signals, lazy-loaded routes).
  Note: the task requested Angular 22, but the environment this was built in
  couldn't satisfy Angular 22's Node engine requirement. Angular 21 was used
  instead and this is disclosed honestly in `README.md`. If Claude Code's
  environment has a newer Node version available, consider upgrading to Angular 22
  to match the task's ask exactly — check `node --version` (needs `^22.22.3` or
  `^24.15.0` or `>=26.0.0` for Angular 22) and run
  `npx @angular/cli@latest update` if so.
- Student flow: `/videos` (list) → `/videos/:id` (player with YouTube IFrame API +
  RxJS-driven annotation overlay for multiple-choice, fill-in-blank, and note
  annotation types).
- Admin flow: `/admin` (dashboard, add video by YouTube link) →
  `/admin/videos/:id` (add/remove checkpoints on that video).
- Data layer: `VideoLibrary` service (`src/app/core/services/video-library.ts`),
  `BehaviorSubject`-backed, persists to `localStorage`, seeded with 2 demo videos.
- `npm run build` passes. `npm test` passes (only the default app-shell smoke
  test currently — see "Not done" below).

**Not done / next steps, roughly in priority order:**
1. **Manual/visual QA in an actual browser.** This was built and verified via
   `ng build` + `ng test` + code review only — nobody has actually clicked through
   it in a browser yet. Run `npm start`, open `http://localhost:4200`, and
   actually watch a video, trigger a multiple-choice and a fill-in-blank
   annotation, add a video as admin, add/remove a checkpoint, and confirm the
   rewind-retriggers-annotations behavior works. Fix anything that's broken or
   feels rough before submitting.
2. **Unit tests beyond the default shell test.** Priority targets: `VideoLibrary`
   (add/remove video, add/remove annotation, localStorage persistence,
   `extractYoutubeId` edge cases) and the annotation-triggering logic in
   `VideoPlayer` (this is the evaluated centerpiece, so it's worth having tests
   that demonstrate it works, not just a working build).
3. **Git init + push to GitHub**, since the submission requires a repo link.
   This repo has not been git-initialized yet (`git init` hasn't been run).
4. **Decide on deployment vs. "run locally" instructions.** Submission requires
   either a deployed demo URL or clear local-run instructions (already in
   `README.md`). If deploying, a static host (Netlify/Vercel/GitHub
   Pages/Cloudflare Pages) is the natural fit since this is a fully client-side
   Angular app with no backend.
5. **Optional:** a <5 minute walkthrough video, per the submission guidelines.

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
    services/youtube-api-loader.ts # Lazy-loads the YT IFrame API script once
  features/
    student/
      video-list/                  # /videos
      video-player/                # /videos/:id — the RxJS centerpiece
    admin/
      admin-dashboard/             # /admin
      video-editor/                # /admin/videos/:id
  shared/components/nav/           # top nav
  app.routes.ts
  app.ts / app.html / app.scss     # shell
```

## Commands

```bash
npm install
npm start        # dev server, http://localhost:4200
npm run build    # production build
npm test         # unit tests (vitest via Angular CLI)
```
