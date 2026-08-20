import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Annotation,
  NewAnnotationInput,
  NewVideoInput,
  VideoItem,
} from '../models/video.model';

const STORAGE_KEY = 'mcp-video-annotator:videos';

/**
 * Seed data so the app is useful the moment it loads, without requiring an
 * admin to add content first. Timestamps below correspond to real moments
 * in the seeded public YouTube videos.
 */
const SEED_VIDEOS: VideoItem[] = [
  {
    id: 'seed-1',
    title: 'Introduction to Photosynthesis',
    description:
      'A short overview of how plants convert sunlight into energy, with checkpoints to confirm understanding along the way.',
    youtubeId: 'UPBMG5EYydo',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    annotations: [
      {
        id: 'seed-1-a1',
        timestamp: 15,
        type: 'note',
        prompt:
          'Keep an eye out for the two ingredients plants need most: sunlight and water.',
        pauseVideo: false,
      },
      {
        id: 'seed-1-a2',
        timestamp: 45,
        type: 'multiple-choice',
        prompt: 'Which gas do plants take in during photosynthesis?',
        options: [
          { id: 'a', text: 'Oxygen' },
          { id: 'b', text: 'Carbon dioxide' },
          { id: 'c', text: 'Nitrogen' },
        ],
        correctAnswer: 'b',
        pauseVideo: true,
      },
      {
        id: 'seed-1-a3',
        timestamp: 90,
        type: 'fill-in-blank',
        prompt: 'Photosynthesis takes place mainly inside the plant\u2019s _____.',
        correctAnswer: 'leaves',
        pauseVideo: true,
      },
    ],
  },
  {
    id: 'seed-2',
    title: 'The Water Cycle Explained',
    description:
      'Follow a single drop of water through evaporation, condensation, and precipitation.',
    youtubeId: 'al-do-HGuIk',
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    annotations: [
      {
        id: 'seed-2-a1',
        timestamp: 20,
        type: 'multiple-choice',
        prompt: 'What causes water to evaporate from oceans and lakes?',
        options: [
          { id: 'a', text: 'Heat from the sun' },
          { id: 'b', text: 'Wind alone' },
          { id: 'c', text: 'Ocean currents' },
        ],
        correctAnswer: 'a',
        pauseVideo: true,
      },
    ],
  },
];

function loadFromStorage(): VideoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_VIDEOS;
    const parsed = JSON.parse(raw) as VideoItem[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED_VIDEOS;
  } catch {
    return SEED_VIDEOS;
  }
}

function persist(videos: VideoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  } catch {
    // Storage can fail in private-browsing contexts; the in-memory state
    // still works for the current session, so we simply skip persistence.
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extracts a bare YouTube video id from either a full URL
 * (youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID) or an id
 * that was already pasted in directly.
 */
export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([\w-]{11})/,
    /^([\w-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class VideoLibrary {
  private readonly videosSubject = new BehaviorSubject<VideoItem[]>(loadFromStorage());

  /** Stream of the full video library, newest first. */
  readonly videos$: Observable<VideoItem[]> = this.videosSubject.asObservable();

  getVideoById$(id: string): Observable<VideoItem | undefined> {
    return this.videos$.pipe(map((videos) => videos.find((v) => v.id === id)));
  }

  addVideo(input: NewVideoInput): VideoItem {
    const video: VideoItem = {
      ...input,
      id: makeId('video'),
      createdAt: Date.now(),
      annotations: [],
    };
    this.update([video, ...this.videosSubject.value]);
    return video;
  }

  removeVideo(videoId: string): void {
    this.update(this.videosSubject.value.filter((v) => v.id !== videoId));
  }

  addAnnotation(videoId: string, input: NewAnnotationInput): void {
    const annotation: Annotation = { ...input, id: makeId('annotation') };
    this.update(
      this.videosSubject.value.map((v) =>
        v.id === videoId
          ? {
              ...v,
              annotations: [...v.annotations, annotation].sort(
                (a, b) => a.timestamp - b.timestamp,
              ),
            }
          : v,
      ),
    );
  }

  removeAnnotation(videoId: string, annotationId: string): void {
    this.update(
      this.videosSubject.value.map((v) =>
        v.id === videoId
          ? { ...v, annotations: v.annotations.filter((a) => a.id !== annotationId) }
          : v,
      ),
    );
  }

  private update(videos: VideoItem[]): void {
    this.videosSubject.next(videos);
    persist(videos);
  }
}
