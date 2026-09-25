import { CompanySettings } from '../types/booking';

export const ICON_SIZES = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

export interface AppBranding {
  appName: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  faviconUrl?: string;
  appIconUrl?: string;
}

export const DEFAULT_BRANDING: AppBranding = {
  appName: 'TAMIMA Hotel Booking',
  shortName: 'TAMIMA Hotel',
  description: 'TAMIMA Hotel Booking Management System',
  themeColor: '#0B1F3A',
  backgroundColor: '#ffffff',
};

export const brandingFromSettings = (s: CompanySettings): AppBranding => ({
  appName: s.appName || DEFAULT_BRANDING.appName,
  shortName: s.shortName || DEFAULT_BRANDING.shortName,
  description: s.appDescription || DEFAULT_BRANDING.description,
  themeColor: s.themeColor || DEFAULT_BRANDING.themeColor,
  backgroundColor: s.backgroundColor || DEFAULT_BRANDING.backgroundColor,
  appIconUrl: s.appIconUrl || s.logoUrl || undefined,
});

/* ---------------- Dynamic favicon ---------------- */

export function applyDynamicFavicon(url: string | undefined) {
  const href = url || '/icons/icon-512.png';
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = href.startsWith('data:') ? 'image/png' : 'image/png';
  link.href = href;

  // Apple touch icon for iOS home-screen installs
  let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    document.head.appendChild(apple);
  }
  apple.href = href;
}

/* ---------------- Icon generation ---------------- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Generate the full PWA icon set from one uploaded image (original preserved). */
export async function generateIconSet(dataUrl: string): Promise<{ src: string; sizes: string; type: string; purpose: string }[]> {
  const img = await loadImage(dataUrl);
  return Promise.all(
    ICON_SIZES.map(
      (size) =>
        new Promise<{ src: string; sizes: string; type: string; purpose: string }>((resolve) => {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#0B1F3A';
          ctx.fillRect(0, 0, size, size);
          // contain-fit, centered, preserving aspect & transparency
          const scale = Math.min(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve({ src: canvas.toDataURL('image/png'), sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' });
        })
    )
  );
}

/* ---------------- Dynamic manifest ---------------- */

let manifestBlobUrl: string | null = null;

export async function applyDynamicManifest(branding: AppBranding) {
  let icons: { src: string; sizes: string; type: string; purpose: string }[] = [
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon-512.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  ];
  if (branding.appIconUrl) {
    try {
      const set = await generateIconSet(branding.appIconUrl);
      icons = [...set, { ...set[set.length - 1], purpose: 'maskable' }];
    } catch {
      /* keep default icons */
    }
  }

  const manifest = {
    name: branding.appName,
    short_name: branding.shortName,
    description: branding.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: branding.backgroundColor,
    theme_color: branding.themeColor,
    lang: 'en',
    icons,
  };

  if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
  manifestBlobUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  link.href = manifestBlobUrl;

  // theme-color meta
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = branding.themeColor;

  let appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (!appleTitle) {
    appleTitle = document.createElement('meta');
    appleTitle.name = 'apple-mobile-web-app-title';
    document.head.appendChild(appleTitle);
  }
  appleTitle.content = branding.shortName;

  document.title = branding.appName;
}

/* ---------------- Service worker registration + updates ---------------- */

export function registerServiceWorker(onUpdateAvailable?: () => void) {
  if (!('serviceWorker' in navigator)) return;
  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
  if (isDev) return; // dev server: no SW caching

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            onUpdateAvailable?.();
          }
        });
      });

      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch {
      /* SW unavailable (e.g. single-file preview) — app still works online */
    }
  });
}

export function activatePendingUpdate() {
  navigator.serviceWorker
    .getRegistration()
    .then((reg) => reg?.waiting?.postMessage({ type: 'SKIP_WAITING' }))
    .catch(() => {});
}

/* ---------------- Install prompt ---------------- */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}
