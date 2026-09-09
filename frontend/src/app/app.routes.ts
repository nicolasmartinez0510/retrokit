import { Routes } from '@angular/router';
import {
  authGuard,
  guestGuard,
  homeRedirectGuard,
  tokenGuard,
} from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [homeRedirectGuard],
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'teams/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/team/team.page').then((m) => m.TeamPage),
  },
  {
    path: 'teams/:id/actions',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/actions/actions.page').then((m) => m.ActionsPage),
  },
  {
    path: 'retros/:id',
    canActivate: [tokenGuard],
    loadComponent: () =>
      import('./pages/retro/retro.page').then((m) => m.RetroPage),
  },
  {
    path: 'retros/:id/report',
    canActivate: [tokenGuard],
    loadComponent: () =>
      import('./pages/report/report.page').then((m) => m.ReportPage),
  },
  {
    path: 'join/:code',
    loadComponent: () =>
      import('./pages/join/join.page').then((m) => m.JoinPage),
  },
  { path: '**', redirectTo: '' },
];
