import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'videos', pathMatch: 'full' },
  {
    path: 'videos',
    loadComponent: () =>
      import('./features/student/video-list/video-list').then((m) => m.VideoList),
  },
  {
    path: 'videos/:id',
    loadComponent: () =>
      import('./features/student/video-player/video-player').then((m) => m.VideoPlayer),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin-dashboard/admin-dashboard').then(
        (m) => m.AdminDashboard,
      ),
  },
  {
    path: 'admin/videos/:id',
    loadComponent: () =>
      import('./features/admin/video-editor/video-editor').then((m) => m.VideoEditor),
  },
  { path: '**', redirectTo: 'videos' },
];
