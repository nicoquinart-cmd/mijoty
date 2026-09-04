import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="theme-color" content="#C96545" />
        <meta name="application-name" content="Mijoty" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Mijoty" />
        <link rel="manifest" href="/manifest.json?v=112" />
        <link rel="icon" href="/favicon.ico?v=112" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico?v=112" />
        <link rel="icon" type="image/png" sizes="192x192" href="/mijoty-icon-192.png?v=112" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=112" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }); }` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
