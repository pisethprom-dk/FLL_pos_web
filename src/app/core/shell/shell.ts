// v1.1.0 — the frame around every signed-in screen: the sidebar menu, the top
// bar, and the outlet the screens render into.
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { RatePipe } from '../../shared/money/money-pipes';
import { SessionStore } from '../session/session-store';
import { PageTitle } from './page-title';
import { MENU, MenuGroup, SCREENS, Screen } from './screens';
import { ShopInfo } from './shop-info';

interface NavLink {
  readonly kind: 'link';
  readonly key: string;
  readonly screen: Screen;
  readonly active: boolean;
}

interface NavGroup {
  readonly kind: 'group';
  readonly key: string;
  readonly label: string;
  readonly links: readonly NavLink[];
  readonly open: boolean;
  readonly hasActive: boolean;
}

interface NavSection {
  readonly key: string;
  readonly heading: string | null;
  readonly items: readonly (NavLink | NavGroup)[];
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, DatePipe, RatePipe],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly shop = inject(ShopInfo);

  protected readonly title = inject(PageTitle).current;
  protected readonly user = this.session.user;
  protected readonly today = new Date();

  // Display only — what a role may do comes from its scopes, never its name.
  protected readonly roleLabel = computed(() => {
    const role = this.user()?.role;
    return role ? role.charAt(0) + role.slice(1).toLowerCase() : '';
  });

  protected readonly profile = this.shop.profile;
  protected readonly rate = this.shop.rate;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  private readonly path = computed(() => this.url().split(/[?#]/)[0]);
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  /** The menu as this user sees it: screens they lack the scope for are left out. */
  protected readonly menu = computed<readonly NavSection[]>(() => {
    const path = this.path();
    const collapsed = this.collapsed();
    const link = (id: keyof typeof SCREENS): NavLink | null => {
      const screen: Screen = SCREENS[id];
      if (!this.session.hasAnyScope(screen.scopes)) return null;
      return { kind: 'link', key: id, screen, active: isActive(path, screen.path) };
    };

    return MENU.map((section, index) => {
      const items: (NavLink | NavGroup)[] = [];
      for (const entry of section.entries) {
        if (typeof entry === 'string') {
          const item = link(entry);
          if (item) items.push(item);
          continue;
        }
        const links = entry.screens.map(link).filter((item): item is NavLink => item !== null);
        if (links.length === 0) continue;
        items.push({
          kind: 'group',
          key: entry.group,
          label: entry.label,
          links,
          open: !collapsed.has(entry.group),
          hasActive: links.some((item) => item.active),
        });
      }
      return { key: section.heading ?? `section-${index}`, heading: section.heading, items };
    }).filter((section) => section.items.length > 0);
  });

  constructor() {
    this.shop.load();

    // Arriving on a screen opens the group it sits in, as the mockup does. This
    // follows navigation only, so a group the user closes stays closed.
    effect(() => {
      const path = this.path();
      const opening = MENU.flatMap((section) => section.entries)
        .filter((entry): entry is MenuGroup => typeof entry !== 'string')
        .filter((group) => group.screens.some((id) => isActive(path, SCREENS[id].path)))
        .map((group) => group.group);
      if (opening.length === 0) return;
      untracked(() =>
        this.collapsed.update((keys) => new Set([...keys].filter((key) => !opening.includes(key)))),
      );
    });
  }

  protected toggle(group: string): void {
    this.collapsed.update((keys) => {
      const next = new Set(keys);
      if (!next.delete(group)) next.add(group);
      return next;
    });
  }

  protected signOut(): void {
    void this.session.logout();
  }
}

/** Is the screen at `screenPath` showing, or something beneath it? */
function isActive(path: string, screenPath: string): boolean {
  if (screenPath === '') return path === '/';
  return path === `/${screenPath}` || path.startsWith(`/${screenPath}/`);
}
