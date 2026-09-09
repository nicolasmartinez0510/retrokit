// This file is part of Retrokit.
//
// Copyright (C) 2026 Nicolas Martinez
//
// Retrokit is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Retrokit is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Retrokit.  If not, see <https://www.gnu.org/licenses/>.

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
