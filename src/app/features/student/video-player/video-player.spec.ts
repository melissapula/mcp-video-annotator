import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { VideoItem } from '../../../core/models/video.model';
import { VideoLibrary } from '../../../core/services/video-library';
import { YoutubeApiLoader } from '../../../core/services/youtube-api-loader';
import { VideoPlayer } from './video-player';

/** Minimal stand-in for `YT.PlayerState`. */
const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

/** Minimal stand-in for a `YT.Player` instance, driven manually by the tests. */
class FakePlayer {
  currentTime = 0;
  paused = false;
  destroyed = false;
  private readonly onStateChange?: (event: { data: number }) => void;

  constructor(
    _element: HTMLElement,
    options: { events?: { onStateChange?: (event: { data: number }) => void } },
  ) {
    this.onStateChange = options.events?.onStateChange;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  pauseVideo(): void {
    this.paused = true;
  }

  playVideo(): void {
    this.paused = false;
  }

  destroy(): void {
    this.destroyed = true;
  }

  /** Test helper: simulate the YouTube iframe reporting a state change. */
  emitState(state: number): void {
    this.onStateChange?.({ data: state });
  }
}

const TEST_VIDEO: VideoItem = {
  id: 'v1',
  title: 'Test video',
  description: 'A video used for tests',
  youtubeId: 'abc12345678',
  createdAt: Date.now(),
  annotations: [
    { id: 'a1', timestamp: 1, type: 'note', prompt: 'Heads up', pauseVideo: false },
    {
      id: 'a2',
      timestamp: 2,
      type: 'multiple-choice',
      prompt: 'Pick one',
      options: [
        { id: 'x', text: 'Right' },
        { id: 'y', text: 'Wrong' },
      ],
      correctAnswer: 'x',
      pauseVideo: true,
    },
    {
      id: 'a3',
      timestamp: 3,
      type: 'fill-in-blank',
      prompt: 'Type it',
      correctAnswer: 'answer',
      pauseVideo: true,
    },
  ],
};

/** Advances real time and flushes microtasks so RxJS `interval` polling ticks. */
async function tick(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('VideoPlayer', () => {
  let lastPlayer: FakePlayer | undefined;

  beforeEach(async () => {
    lastPlayer = undefined;
    const FakeYT = {
      PlayerState,
      Player: class extends FakePlayer {
        constructor(element: HTMLElement, options: unknown) {
          super(element, options as { events?: { onStateChange?: (e: { data: number }) => void } });
          lastPlayer = this;
        }
      },
    };

    await TestBed.configureTestingModule({
      imports: [VideoPlayer],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: TEST_VIDEO.id })) },
        },
        { provide: VideoLibrary, useValue: { getVideoById$: () => of(TEST_VIDEO) } },
        { provide: YoutubeApiLoader, useValue: { load: () => Promise.resolve(FakeYT) } },
      ],
    }).compileComponents();
  });

  async function createAndInitPlayer() {
    const fixture = TestBed.createComponent(VideoPlayer);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    if (!lastPlayer) {
      // The YT API promise and the ViewChild signal both resolve async; give
      // one more microtask turn for `combineLatest` to fire.
      await Promise.resolve();
      fixture.detectChanges();
    }
    return { fixture, component: fixture.componentInstance };
  }

  /**
   * Walks playback through each checkpoint up to and including `targetId`,
   * calling `continue()` after every earlier one so only the target
   * annotation is left active — mirrors how a student would actually reach
   * a later checkpoint one at a time.
   */
  async function advanceTo(component: VideoPlayer, targetId: string): Promise<void> {
    for (const annotation of TEST_VIDEO.annotations) {
      lastPlayer!.currentTime = annotation.timestamp;
      await tick(250);
      if (annotation.id === targetId) return;
      component.continue();
    }
  }

  it('creates the underlying YT.Player once the view and API are ready', async () => {
    await createAndInitPlayer();
    expect(lastPlayer).toBeTruthy();
  });

  it('triggers a note annotation once playback reaches its timestamp', async () => {
    const { component } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);
    lastPlayer!.currentTime = 1;
    await tick(250);

    expect(component.activeAnnotation()?.id).toBe('a1');
  });

  it('does not pause the video for an annotation with pauseVideo: false', async () => {
    const { component } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);
    lastPlayer!.currentTime = 1;
    await tick(250);

    expect(component.activeAnnotation()?.id).toBe('a1');
    expect(lastPlayer!.paused).toBe(false);
  });

  it('pauses the video for an annotation with pauseVideo: true', async () => {
    const { component } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);
    await advanceTo(component, 'a2');

    expect(component.activeAnnotation()?.id).toBe('a2');
    expect(lastPlayer!.paused).toBe(true);
  });

  it('only shows one checkpoint at a time even if playback passes a second timestamp', async () => {
    const { component } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);
    lastPlayer!.currentTime = 1;
    await tick(250);
    expect(component.activeAnnotation()?.id).toBe('a1');

    // Playback keeps advancing past the second checkpoint's timestamp while
    // the first annotation is still on screen.
    lastPlayer!.currentTime = 2.5;
    await tick(250);

    expect(component.activeAnnotation()?.id).toBe('a1');
  });

  it('advances to the next checkpoint after continue() is called', async () => {
    const { component } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);
    lastPlayer!.currentTime = 1;
    await tick(250);
    expect(component.activeAnnotation()?.id).toBe('a1');

    component.continue();
    lastPlayer!.currentTime = 2;
    await tick(250);

    expect(component.activeAnnotation()?.id).toBe('a2');
  });

  it('lets a rewind past a checkpoint retrigger it on replay', async () => {
    const { component } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);
    lastPlayer!.currentTime = 1;
    await tick(250);
    expect(component.activeAnnotation()?.id).toBe('a1');

    component.continue();

    // Manual rewind to well before the checkpoint (more than the 1s rewind
    // threshold) should clear it from the triggered set.
    lastPlayer!.currentTime = -0.5;
    await tick(250);
    expect(component.activeAnnotation()).toBeNull();

    // Playing forward again should retrigger the same checkpoint.
    lastPlayer!.currentTime = 1;
    await tick(250);
    expect(component.activeAnnotation()?.id).toBe('a1');
  });

  it('grades a correct multiple-choice answer', async () => {
    const { component } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);
    await advanceTo(component, 'a2');
    expect(component.activeAnnotation()?.id).toBe('a2');

    component.selectOption('x');
    component.submitAnswer();

    expect(component.feedback()).toBe('correct');
  });

  it('grades an incorrect multiple-choice answer', async () => {
    const { component } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);
    await advanceTo(component, 'a2');

    component.selectOption('y');
    component.submitAnswer();

    expect(component.feedback()).toBe('incorrect');
  });

  it('grades a fill-in-blank answer case-insensitively and ignoring surrounding whitespace', async () => {
    const { component } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);
    await advanceTo(component, 'a3');
    expect(component.activeAnnotation()?.id).toBe('a3');

    component.fillInAnswer.set('  ANSWER  ');
    component.submitAnswer();

    expect(component.feedback()).toBe('correct');
  });

  it('grades a wrong fill-in-blank answer as incorrect', async () => {
    const { component } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);
    await advanceTo(component, 'a3');

    component.fillInAnswer.set('nope');
    component.submitAnswer();

    expect(component.feedback()).toBe('incorrect');
  });

  it('stops polling and destroys the player on destroy', async () => {
    const { fixture } = await createAndInitPlayer();

    lastPlayer!.emitState(PlayerState.PLAYING);

    fixture.destroy();

    expect(lastPlayer!.destroyed).toBe(true);
  });
});
