import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { VideoItem } from '../../../core/models/video.model';
import { VideoLibrary } from '../../../core/services/video-library';

@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './video-list.html',
  styleUrl: './video-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoList {
  private readonly library = inject(VideoLibrary);

  readonly videos$: Observable<VideoItem[]> = this.library.videos$;

  thumbnailUrl(video: VideoItem): string {
    return `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
  }
}
