import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthResponse, TeamSummary, User } from './models';

const TOKEN_KEY = 'retrokit_token';
const USER_KEY = 'retrokit_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<User | null>(this.readUser());
  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  /** Any JWT present (user or guest). */
  readonly isLoggedIn = computed(() => !!this.token());
  /** Registered user (not guest). */
  readonly isUser = computed(
    () => !!this.token() && this.user()?.type !== 'guest',
  );
  readonly isGuest = computed(() => this.user()?.type === 'guest');

  private meRequest: Observable<User | null> | null = null;
  private facilitatorRequest: Observable<boolean> | null = null;

  constructor() {
    if (this.isUser()) {
      this.ensureFacilitator().subscribe();
    }
  }

  register(payload: { email: string; password: string; name: string }) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, payload)
      .pipe(
        tap((res) => this.persist(res)),
        switchMap((res) =>
          this.ensureFacilitator().pipe(map(() => res)),
        ),
      );
  }

  login(payload: { email: string; password: string }) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, payload)
      .pipe(
        tap((res) => this.persist(res)),
        switchMap((res) =>
          this.ensureFacilitator().pipe(map(() => res)),
        ),
      );
  }

  /** Resolves whether the current user can manage templates. */
  ensureFacilitator(): Observable<boolean> {
    if (!this.isUser()) return of(false);
    if (this.user()?.isFacilitator) return of(true);
    if (!this.facilitatorRequest) {
      this.facilitatorRequest = this.ensureMe().pipe(
        switchMap((user) => {
          if (user?.isFacilitator) return of(true);
          return this.http.get<TeamSummary[]>(`${environment.apiUrl}/teams`).pipe(
            map((teams) =>
              teams.some(
                (t) =>
                  t.role === 'facilitator' ||
                  t.members?.[0]?.role === 'facilitator',
              ),
            ),
            catchError(() => of(false)),
          );
        }),
        tap((isFacilitator) => {
          const current = this.user();
          if (!current || current.type === 'guest') return;
          if (current.isFacilitator === isFacilitator) return;
          this.writeUser({ ...current, isFacilitator });
        }),
        shareReplay(1),
      );
    }
    return this.facilitatorRequest;
  }

  markFacilitator() {
    const current = this.user();
    if (!current || current.type === 'guest' || current.isFacilitator) return;
    this.writeUser({ ...current, isFacilitator: true });
    this.facilitatorRequest = null;
  }

  /** Re-fetch /auth/me so isFacilitator can drop after deleting a team. */
  refreshProfile(): Observable<User | null> {
    this.meRequest = null;
    this.facilitatorRequest = null;
    return this.ensureMe();
  }

  setGuestToken(token: string, name: string, retroId: string, participantId: string) {
    localStorage.setItem(TOKEN_KEY, token);
    const user: User = {
      id: participantId,
      email: '',
      name,
      type: 'guest',
      participantId,
      retroId,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.token.set(token);
    this.user.set(user);
    this.meRequest = null;
    this.facilitatorRequest = null;
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
    this.meRequest = null;
    this.facilitatorRequest = null;
    void this.router.navigateByUrl('/login');
  }

  private ensureMe(): Observable<User | null> {
    if (!this.isUser()) return of(null);
    if (!this.meRequest) {
      this.meRequest = this.http.get<User>(`${environment.apiUrl}/auth/me`).pipe(
        map((profile) => {
          if (profile.type === 'guest') return this.user();
          const previous = this.user();
          const user: User = {
            ...previous,
            ...profile,
            type: 'user',
            isFacilitator:
              typeof profile.isFacilitator === 'boolean'
                ? profile.isFacilitator
                : false,
          };
          this.writeUser(user);
          return user;
        }),
        catchError(() => of(this.user())),
        shareReplay(1),
      );
    }
    return this.meRequest;
  }

  private persist(res: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    const user: User = {
      ...res.user,
      type: 'user',
      isFacilitator: !!res.user.isFacilitator,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.token.set(res.accessToken);
    this.user.set(user);
    this.meRequest = null;
    this.facilitatorRequest = null;
  }

  private writeUser(user: User) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
  }

  private readUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
