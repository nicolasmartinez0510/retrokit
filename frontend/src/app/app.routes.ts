import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  guestGuard,
  homeRedirectGuard,
  templateEditorGuard,
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
    path: 'teams',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/teams/teams.page').then((m) => m.TeamsPage),
  },
  {
    path: 'users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/users/users.page').then((m) => m.UsersPage),
  },
  {
    path: 'templates',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/templates/templates.page').then((m) => m.TemplatesPage),
  },
  {
    path: 'templates/new',
    canActivate: [authGuard, templateEditorGuard],
    loadComponent: () =>
      import('./pages/templates/template-editor.page').then(
        (m) => m.TemplateEditorPage,
      ),
  },
  {
    path: 'templates/:id',
    canActivate: [authGuard, templateEditorGuard],
    loadComponent: () =>
      import('./pages/templates/template-editor.page').then(
        (m) => m.TemplateEditorPage,
      ),
  },
  {
    path: 'teams/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/team/team.page').then((m) => m.TeamPage),
  },
  {
    path: 'teams/:id/actions/avances',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/actions/action-progress.page').then(
        (m) => m.ActionProgressPage,
      ),
  },
  {
    path: 'teams/:id/actions',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/actions/actions.page').then((m) => m.ActionsPage),
  },
  {
    path: 'teams/:id/members',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/members/members.page').then((m) => m.MembersPage),
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
  {
    path: 'join-team/:code',
    loadComponent: () =>
      import('./pages/join-team/join-team.page').then((m) => m.JoinTeamPage),
  },
  { path: '**', redirectTo: '' },
];
