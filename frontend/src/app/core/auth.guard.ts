import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
} from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';

function safeReturnUrl(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

/** Requires a registered user account (not guest). */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isUser()) return true;
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/** Requires any JWT (user or guest) — for retro rooms. */
export const tokenGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/** Redirect logged-in users away from auth pages. */
export const guestGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isUser()) return true;
  const returnUrl = safeReturnUrl(route.queryParamMap.get('returnUrl'));
  if (returnUrl) return router.parseUrl(returnUrl);
  return router.createUrlTree(['/dashboard']);
};

/** '' → dashboard if user, else login. */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isUser()
    ? router.createUrlTree(['/dashboard'])
    : router.createUrlTree(['/login']);
};

/** Requires a user who is facilitator of at least one team. */
export const facilitatorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isUser()) return router.createUrlTree(['/login']);
  return auth.ensureFacilitator().pipe(
    map((ok) => (ok ? true : router.createUrlTree(['/dashboard']))),
  );
};
