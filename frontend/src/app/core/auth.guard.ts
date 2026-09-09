import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Requires a registered user account (not guest). */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isUser()) return true;
  return router.createUrlTree(['/login']);
};

/** Requires any JWT (user or guest) — for retro rooms. */
export const tokenGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login']);
};

/** Redirect logged-in users away from auth pages. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isUser()) return router.createUrlTree(['/dashboard']);
  return true;
};

/** '' → dashboard if user, else login. */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isUser()
    ? router.createUrlTree(['/dashboard'])
    : router.createUrlTree(['/login']);
};
