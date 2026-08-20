import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { VideoItem } from '../../../core/models/video.model';
import { extractYoutubeId, VideoLibrary } from '../../../core/services/video-library';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  private readonly library = inject(VideoLibrary);

  readonly videos$: Observable<VideoItem[]> = this.library.videos$;

  readonly title = signal('');
  readonly description = signal('');
  readonly urlOrId = signal('');
  readonly formError = signal<string | null>(null);

  addVideo(): void {
    const youtubeId = extractYoutubeId(this.urlOrId());
    if (!this.title().trim()) {
      this.formError.set('Give the video a title.');
      return;
    }
    if (!youtubeId) {
      this.formError.set(
        "Couldn't find a valid YouTube video id in that link. Try pasting the full URL.",
      );
      return;
    }

    this.library.addVideo({
      title: this.title().trim(),
      description: this.description().trim(),
      youtubeId,
    });

    this.formError.set(null);
    this.title.set('');
    this.description.set('');
    this.urlOrId.set('');
  }

  removeVideo(videoId: string): void {
    this.library.removeVideo(videoId);
  }
}
