import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, switchMap } from 'rxjs';
import { AnnotationType, VideoItem } from '../../../core/models/video.model';
import { VideoLibrary } from '../../../core/services/video-library';

interface DraftOption {
  id: string;
  text: string;
}

@Component({
  selector: 'app-video-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './video-editor.html',
  styleUrl: './video-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoEditor {
  private readonly route = inject(ActivatedRoute);
  private readonly library = inject(VideoLibrary);

  readonly video$: Observable<VideoItem | undefined> = this.route.paramMap.pipe(
    switchMap((params) => this.library.getVideoById$(params.get('id') ?? '')),
  );

  readonly type = signal<AnnotationType>('multiple-choice');
  readonly timestamp = signal<number>(0);
  readonly prompt = signal('');
  readonly pauseVideo = signal(true);
  readonly correctAnswer = signal('');
  readonly options = signal<DraftOption[]>([
    { id: 'a', text: '' },
    { id: 'b', text: '' },
  ]);
  readonly formError = signal<string | null>(null);

  updateOptionText(id: string, text: string): void {
    this.options.set(this.options().map((o) => (o.id === id ? { ...o, text } : o)));
  }

  addOption(): void {
    const nextId = String.fromCharCode(97 + this.options().length); // a, b, c, d...
    this.options.set([...this.options(), { id: nextId, text: '' }]);
  }

  removeOption(id: string): void {
    if (this.options().length <= 2) return;
    this.options.set(this.options().filter((o) => o.id !== id));
    if (this.correctAnswer() === id) this.correctAnswer.set('');
  }

  addAnnotation(videoId: string): void {
    if (!this.prompt().trim()) {
      this.formError.set('Add a prompt for the checkpoint.');
      return;
    }
    if (this.timestamp() < 0) {
      this.formError.set('Timestamp must be zero or later.');
      return;
    }

    if (this.type() === 'multiple-choice') {
      const filledOptions = this.options().filter((o) => o.text.trim());
      if (filledOptions.length < 2) {
        this.formError.set('Add at least two answer options.');
        return;
      }
      if (!this.correctAnswer()) {
        this.formError.set('Mark which option is correct.');
        return;
      }
      this.library.addAnnotation(videoId, {
        timestamp: this.timestamp(),
        type: 'multiple-choice',
        prompt: this.prompt().trim(),
        options: filledOptions.map((o) => ({ id: o.id, text: o.text.trim() })),
        correctAnswer: this.correctAnswer(),
        pauseVideo: this.pauseVideo(),
      });
    } else if (this.type() === 'fill-in-blank') {
      if (!this.correctAnswer().trim()) {
        this.formError.set('Add the expected answer.');
        return;
      }
      this.library.addAnnotation(videoId, {
        timestamp: this.timestamp(),
        type: 'fill-in-blank',
        prompt: this.prompt().trim(),
        correctAnswer: this.correctAnswer().trim(),
        pauseVideo: this.pauseVideo(),
      });
    } else {
      this.library.addAnnotation(videoId, {
        timestamp: this.timestamp(),
        type: 'note',
        prompt: this.prompt().trim(),
        pauseVideo: this.pauseVideo(),
      });
    }

    this.resetForm();
  }

  removeAnnotation(videoId: string, annotationId: string): void {
    this.library.removeAnnotation(videoId, annotationId);
  }

  private resetForm(): void {
    this.prompt.set('');
    this.timestamp.set(0);
    this.correctAnswer.set('');
    this.options.set([
      { id: 'a', text: '' },
      { id: 'b', text: '' },
    ]);
    this.formError.set(null);
  }
}
