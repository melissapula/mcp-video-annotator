export type AnnotationType = 'multiple-choice' | 'fill-in-blank' | 'note';

export interface AnnotationOption {
  id: string;
  text: string;
}

export interface Annotation {
  id: string;
  /** Time in seconds at which this annotation should trigger. */
  timestamp: number;
  type: AnnotationType;
  prompt: string;
  /** Used for multiple-choice annotations. */
  options?: AnnotationOption[];
  /** Option id (multiple-choice) or expected text (fill-in-blank). Optional for 'note'. */
  correctAnswer?: string;
  /** Whether the video should pause automatically when this annotation triggers. */
  pauseVideo: boolean;
}

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  /** Raw YouTube video ID (the part after v= or youtu.be/). */
  youtubeId: string;
  annotations: Annotation[];
  createdAt: number;
}

/** Shape used by the "add video" form before an id/createdAt are assigned. */
export type NewVideoInput = Pick<VideoItem, 'title' | 'description' | 'youtubeId'>;

/** Shape used by the "add annotation" form before an id is assigned. */
export type NewAnnotationInput = Omit<Annotation, 'id'>;
