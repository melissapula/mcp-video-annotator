# Interactive Video Annotation Platform

A demo built for the Modern Classrooms Project performance task. Students watch YouTube
videos that pause at teacher-defined checkpoints for multiple-choice questions,
fill-in-the-blank prompts, or short notes. Teachers can add new videos and checkpoints
from an admin dashboard, no login required (per the task's demo-scope note).

**Live demo:** https://mcp-video-annotator.netlify.app

**Video walkthrough:**

[![Video walkthrough](https://img.youtube.com/vi/k0FCOAXiDuE/maxresdefault.jpg)](https://www.youtube.com/watch?v=k0FCOAXiDuE)

## Tech stack

- **Angular 21** (standalone components, signals, `@if`/`@for`-style control flow via
  `*ngIf`/`*ngFor` directives, lazy-loaded routes). The task asked for Angular 22;
  the sandboxed environment I built this in could only satisfy Angular 21's Node
  engine requirement, so I used the latest version that would install cleanly. The
  architecture (standalone components + signals) is the same either way.
- **RxJS** for all the interactive video logic — see below.
- **YouTube IFrame Player API**, wrapped by hand rather than through a third-party
  Angular video library, so the RxJS work is genuinely mine rather than delegated to
  a plugin.
- No backend — the video/annotation library lives in a `BehaviorSubject`-backed
  Angular service and persists to `localStorage`, so admin edits survive a refresh.

## Where the RxJS mastery shows up

The core interaction is in `video-player.ts`. Rather than polling the YouTube player
on a fixed timer regardless of state, playback time is derived reactively:

```ts
this.playerState$.pipe(
  startWith(YTNamespace.PlayerState.UNSTARTED),
  switchMap((state) =>
    state === YTNamespace.PlayerState.PLAYING
      ? interval(200).pipe(map(() => this.player!.getCurrentTime()))
      : EMPTY,
  ),
  distinctUntilChanged((a, b) => Math.abs(a - b) < 0.05),
  takeUntil(this.destroy$),
).subscribe((time) => this.handleTimeUpdate(time));
```

- `switchMap` means the polling `interval` only exists while the video is actually
  playing — pause, buffer, or end the video and the interval is torn down
  automatically, with no manual `clearInterval` bookkeeping.
- `distinctUntilChanged` collapses near-identical time readings so the annotation
  check doesn't run more than necessary.
- `takeUntil(this.destroy$)` unsubscribes everything when the component is
  destroyed (e.g. navigating back to the video list), avoiding leaked timers.
- Elsewhere, `video-library.ts` exposes the whole library as a single `videos$`
  stream, and both the admin and student routes derive their data with
  `switchMap` off the route's `paramMap`, so navigating between videos re-subscribes
  cleanly without manual teardown logic.

## Trade-offs and things I'd do differently with more time

- **Video source is YouTube-link-only.** The task allowed either a link or a file
  upload; I picked link-only because it avoids needing storage/hosting
  infrastructure for a demo, and it kept the project focused on the actual ask —
  Angular architecture and RxJS — rather than file handling.
- **No authentication**, per the task's explicit note that this is fine for a demo.
  A real version would gate `/admin` behind a teacher login.
- **Persistence is `localStorage`, not a real backend.** Good enough to make the
  admin dashboard feel real in a demo; a production version would need a proper
  API and database so content is shared across devices/users instead of living in
  one browser.
- **Annotation timing is polled, not frame-accurate.** A 200ms poll is plenty
  smooth for question checkpoints but isn't frame-perfect; the YouTube IFrame API
  doesn't expose a native `timeupdate` event the way `<video>` does, so polling
  while playing was the practical option.
- **Styling is hand-rolled SCSS**, not a design system, since the brief asked to
  keep things simple rather than production-polished.

## Running locally

```bash
npm install
npm start        # serves at http://localhost:4200
```

Two routes:
- `/videos` — student view (video list → player with checkpoints)
- `/admin` — teacher dashboard (add videos, manage checkpoints per video)

Seed data (two videos with a few checkpoints each) is included so the app is useful
immediately; anything added through `/admin` persists to `localStorage`.

## Testing

```bash
npm test
```

Unit tests cover `VideoLibrary` (CRUD, sorting, localStorage persistence and
fallback, `extractYoutubeId` URL parsing) and the annotation-triggering logic in
`VideoPlayer` (checkpoint triggering by type, pause-on-checkpoint, one-checkpoint-
at-a-time, rewind re-triggering, and answer grading).

## Build

```bash
npm run build
```
