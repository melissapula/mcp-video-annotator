# Interactive Video Annotation Platform

A demo built for the Modern Classrooms Project performance task. Students watch YouTube
videos that pause at teacher-defined checkpoints for multiple-choice questions,
fill-in-the-blank prompts, or short notes. Teachers can add new videos and checkpoints
from an admin dashboard, no login required (per the task's demo-scope note).

**Live demo:** https://mcp-video-annotator.netlify.app

**Video walkthrough:**

[![Video walkthrough](https://img.youtube.com/vi/k0FCOAXiDuE/maxresdefault.jpg)](https://www.youtube.com/watch?v=k0FCOAXiDuE)

## Tech stack

- **Angular 22** (standalone components, signals, `@if`/`@for`-style control flow via
  `*ngIf`/`*ngFor` directives, lazy-loaded routes). Requires Node `^22.22.3`,
  `^24.15.0`, or `>=26.0.0` — see `.nvmrc` and the problem-solving note below if
  your local Node doesn't already satisfy that.
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

## Problem solving

Two issues worth calling out, since they're a better signal of process than a clean
diff on its own:

**The video never loaded — `@ViewChild({ static: true })` on an element inside
`*ngIf`.** Manual QA (clicking through the actual running app, not just `ng build` +
`ng test`) caught a blank black player with a console error:
`Cannot read properties of undefined (reading 'nativeElement')`. The `<div #playerEl>`
the YouTube Player attaches to sits inside `*ngIf="video$ | async as video"`, so it
doesn't exist in the DOM at the point Angular resolves a `static: true` query —
`playerElRef` was `undefined` forever, and the player silently never initialized.
Fixed by replacing the decorator query with a signal-based `viewChild()`, converted
to an observable via `toObservable()` and combined with the video and YouTube-API
streams through `combineLatest`, so initialization reactively waits for the element
to actually exist. This ended up being a better fit for the RxJS-centric evaluation
criteria than the static query it replaced.

**Angular 22 needs a newer Node than was available.** Angular 22 requires Node
`^22.22.3`, `^24.15.0`, or `>=26.0.0`; the environment's global Node was `24.13.1` —
just below the cutoff. `nvm-windows` was available and could install `24.19.0`, but
switching to it (`nvm use`) failed even with administrator rights: the existing
global Node was a real directory from the official installer, not an nvm-managed
symlink, and `nvm use` needs to delete-and-relink that path — "directory is not
empty." Rather than force it by deleting a non-nvm-managed, MSI-installed Node
folder (risky for anything else on the machine depending on it), the fix was
narrower: run this project's `npm`/`ng` commands against the nvm-installed
`24.19.0` binary directly, and commit a `.nvmrc` pinning that version. That fixes
it for anyone using `nvm`, and Netlify's build also reads `.nvmrc` to pick its
Node version, so the deployed build gets the right version automatically without
touching the local machine's global install at all.

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
