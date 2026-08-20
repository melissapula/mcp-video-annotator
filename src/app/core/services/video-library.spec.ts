import { firstValueFrom } from 'rxjs';
import { extractYoutubeId, VideoLibrary } from './video-library';

describe('extractYoutubeId', () => {
  it('extracts the id from a standard watch URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=UPBMG5EYydo')).toBe('UPBMG5EYydo');
  });

  it('extracts the id when the watch URL has extra query params', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=UPBMG5EYydo&t=30s')).toBe(
      'UPBMG5EYydo',
    );
  });

  it('extracts the id from a youtu.be short link', () => {
    expect(extractYoutubeId('https://youtu.be/UPBMG5EYydo')).toBe('UPBMG5EYydo');
  });

  it('extracts the id from an embed URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/embed/UPBMG5EYydo')).toBe('UPBMG5EYydo');
  });

  it('accepts a bare 11-character id with no URL around it', () => {
    expect(extractYoutubeId('UPBMG5EYydo')).toBe('UPBMG5EYydo');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(extractYoutubeId('  UPBMG5EYydo  ')).toBe('UPBMG5EYydo');
  });

  it('returns null for a URL with no video id', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch')).toBeNull();
  });

  it('returns null for unrelated text', () => {
    expect(extractYoutubeId('not a youtube link')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractYoutubeId('')).toBeNull();
  });
});

describe('VideoLibrary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds two demo videos when localStorage is empty', async () => {
    const library = new VideoLibrary();
    const videos = await firstValueFrom(library.videos$);
    expect(videos.length).toBe(2);
  });

  it('falls back to seed data when localStorage holds invalid JSON', async () => {
    localStorage.setItem('mcp-video-annotator:videos', '{not valid json');
    const library = new VideoLibrary();
    const videos = await firstValueFrom(library.videos$);
    expect(videos.length).toBe(2);
  });

  it('falls back to seed data when localStorage holds an empty array', async () => {
    localStorage.setItem('mcp-video-annotator:videos', '[]');
    const library = new VideoLibrary();
    const videos = await firstValueFrom(library.videos$);
    expect(videos.length).toBe(2);
  });

  describe('addVideo', () => {
    it('adds the new video to the front of the list with a generated id and no annotations', async () => {
      const library = new VideoLibrary();
      const added = library.addVideo({ title: 'New video', description: 'desc', youtubeId: 'xyz' });

      const videos = await firstValueFrom(library.videos$);

      expect(videos.length).toBe(3);
      expect(videos[0].id).toBe(added.id);
      expect(videos[0].title).toBe('New video');
      expect(videos[0].annotations).toEqual([]);
    });

    it('persists the updated library to localStorage', () => {
      const library = new VideoLibrary();
      library.addVideo({ title: 'New video', description: 'desc', youtubeId: 'xyz' });

      const raw = localStorage.getItem('mcp-video-annotator:videos');
      const parsed = JSON.parse(raw ?? '[]');

      expect(parsed.some((v: { title: string }) => v.title === 'New video')).toBe(true);
    });
  });

  describe('removeVideo', () => {
    it('removes the video with the matching id and leaves the rest untouched', async () => {
      const library = new VideoLibrary();
      const added = library.addVideo({ title: 'To remove', description: '', youtubeId: 'xyz' });

      library.removeVideo(added.id);

      const videos = await firstValueFrom(library.videos$);
      expect(videos.find((v) => v.id === added.id)).toBeUndefined();
      expect(videos.length).toBe(2);
    });

    it('is a no-op when the id does not exist', async () => {
      const library = new VideoLibrary();
      const before = await firstValueFrom(library.videos$);

      library.removeVideo('does-not-exist');

      const after = await firstValueFrom(library.videos$);
      expect(after.length).toBe(before.length);
    });
  });

  describe('addAnnotation', () => {
    it('appends an annotation with a generated id', async () => {
      const library = new VideoLibrary();
      const added = library.addVideo({ title: 'V', description: '', youtubeId: 'xyz' });

      library.addAnnotation(added.id, {
        timestamp: 10,
        type: 'note',
        prompt: 'a note',
        pauseVideo: false,
      });

      const video = await firstValueFrom(library.getVideoById$(added.id));
      expect(video?.annotations.length).toBe(1);
      expect(video?.annotations[0].id).toBeTruthy();
      expect(video?.annotations[0].prompt).toBe('a note');
    });

    it('keeps annotations sorted by timestamp regardless of insertion order', async () => {
      const library = new VideoLibrary();
      const added = library.addVideo({ title: 'V', description: '', youtubeId: 'xyz' });

      library.addAnnotation(added.id, {
        timestamp: 30,
        type: 'note',
        prompt: 'later',
        pauseVideo: false,
      });
      library.addAnnotation(added.id, {
        timestamp: 10,
        type: 'note',
        prompt: 'earlier',
        pauseVideo: false,
      });

      const video = await firstValueFrom(library.getVideoById$(added.id));
      expect(video?.annotations.map((a) => a.prompt)).toEqual(['earlier', 'later']);
    });
  });

  describe('removeAnnotation', () => {
    it('removes only the matching annotation from the matching video', async () => {
      const library = new VideoLibrary();
      const added = library.addVideo({ title: 'V', description: '', youtubeId: 'xyz' });
      library.addAnnotation(added.id, {
        timestamp: 10,
        type: 'note',
        prompt: 'keep me',
        pauseVideo: false,
      });
      library.addAnnotation(added.id, {
        timestamp: 20,
        type: 'note',
        prompt: 'remove me',
        pauseVideo: false,
      });

      const withBoth = await firstValueFrom(library.getVideoById$(added.id));
      const toRemove = withBoth!.annotations.find((a) => a.prompt === 'remove me')!;

      library.removeAnnotation(added.id, toRemove.id);

      const video = await firstValueFrom(library.getVideoById$(added.id));
      expect(video?.annotations.map((a) => a.prompt)).toEqual(['keep me']);
    });
  });

  describe('getVideoById$', () => {
    it('resolves to undefined for an unknown id', async () => {
      const library = new VideoLibrary();
      const video = await firstValueFrom(library.getVideoById$('does-not-exist'));
      expect(video).toBeUndefined();
    });
  });
});
