import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, Observable, Subject, combineLatest, from, interval } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  startWith,
  switchMap,
  take,
  takeUntil,
} from 'rxjs/operators';
import { Annotation, VideoItem } from '../../../core/models/video.model';
import { VideoLibrary } from '../../../core/services/video-library';
import { YoutubeApiLoader } from '../../../core/services/youtube-api-loader';

/** How close (in seconds) we poll the player while it's playing. */
const POLL_INTERVAL_MS = 200;
/** A backward jump larger than this is treated as a manual seek/rewind. */
const REWIND_THRESHOLD_SECONDS = 1;

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './video-player.html',
  styleUrl: './video-player.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoPlayer implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly library = inject(VideoLibrary);
  private readonly apiLoader = inject(YoutubeApiLoader);

  /**
   * The div is inside `*ngIf="video$ | async as video"`, so it doesn't exist
   * in the DOM until that observable emits — a signal query (rather than a
   * `static: true` decorator query) is what lets us react to it appearing.
   */
  private readonly playerElRef = viewChild<ElementRef<HTMLDivElement>>('playerEl');
  private readonly playerElRef$ = toObservable(this.playerElRef);

  video$!: Observable<VideoItem | undefined>;

  readonly activeAnnotation = signal<Annotation | null>(null);
  readonly selectedOptionId = signal<string | null>(null);
  readonly fillInAnswer = signal('');
  readonly feedback = signal<'correct' | 'incorrect' | null>(null);

  private player?: YT.Player;
  private annotations: Annotation[] = [];
  private readonly triggeredIds = new Set<string>();
  private lastTime = 0;

  private readonly destroy$ = new Subject<void>();
  private readonly playerState$ = new Subject<number>();

  ngOnInit(): void {
    this.video$ = this.route.paramMap.pipe(
      switchMap((params) => this.library.getVideoById$(params.get('id') ?? '')),
    );

    const video$ = this.video$.pipe(
      filter((video): video is VideoItem => !!video),
      take(1),
    );

    const element$ = this.playerElRef$.pipe(
      filter((el): el is ElementRef<HTMLDivElement> => !!el),
      take(1),
    );

    const ytApi$ = from(this.apiLoader.load());

    combineLatest([video$, element$, ytApi$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([video, element, YTNamespace]) =>
        this.initializePlayer(video, element, YTNamespace),
      );
  }

  private initializePlayer(
    video: VideoItem,
    element: ElementRef<HTMLDivElement>,
    YTNamespace: typeof YT,
  ): void {
    this.annotations = video.annotations;

    this.player = new YTNamespace.Player(element.nativeElement, {
      videoId: video.youtubeId,
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onStateChange: (event: YT.OnStateChangeEvent) => this.playerState$.next(event.data),
      },
    });

    // The heart of the interactivity: only poll for the current time while
    // the video is actually playing (switchMap cancels the interval as soon
    // as playback stops), then de-dupe near-identical readings before
    // checking whether any annotation is due.
    this.playerState$
      .pipe(
        startWith(YTNamespace.PlayerState.UNSTARTED),
        switchMap((state) =>
          state === YTNamespace.PlayerState.PLAYING
            ? interval(POLL_INTERVAL_MS).pipe(map(() => this.player!.getCurrentTime()))
            : EMPTY,
        ),
        distinctUntilChanged((previous, current) => Math.abs(previous - current) < 0.05),
        takeUntil(this.destroy$),
      )
      .subscribe((time) => this.handleTimeUpdate(time));
  }

  private handleTimeUpdate(time: number): void {
    // If the student rewound past an annotation, let it trigger again.
    if (time < this.lastTime - REWIND_THRESHOLD_SECONDS) {
      for (const id of [...this.triggeredIds]) {
        const annotation = this.annotations.find((a) => a.id === id);
        if (annotation && annotation.timestamp >= time) {
          this.triggeredIds.delete(id);
        }
      }
    }
    this.lastTime = time;

    if (this.activeAnnotation()) return; // one checkpoint at a time

    const due = this.annotations.find(
      (a) => !this.triggeredIds.has(a.id) && time >= a.timestamp,
    );
    if (!due) return;

    this.triggeredIds.add(due.id);
    if (due.pauseVideo) this.player?.pauseVideo();
    this.activeAnnotation.set(due);
    this.selectedOptionId.set(null);
    this.fillInAnswer.set('');
    this.feedback.set(null);
  }

  selectOption(optionId: string): void {
    this.selectedOptionId.set(optionId);
  }

  submitAnswer(): void {
    const annotation = this.activeAnnotation();
    if (!annotation) return;

    if (annotation.type === 'multiple-choice') {
      const isCorrect = this.selectedOptionId() === annotation.correctAnswer;
      this.feedback.set(isCorrect ? 'correct' : 'incorrect');
    } else if (annotation.type === 'fill-in-blank') {
      const expected = (annotation.correctAnswer ?? '').trim().toLowerCase();
      const given = this.fillInAnswer().trim().toLowerCase();
      this.feedback.set(expected && given === expected ? 'correct' : 'incorrect');
    }
  }

  continue(): void {
    this.activeAnnotation.set(null);
    this.feedback.set(null);
    this.player?.playVideo();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.player?.destroy();
  }
}
