import type { LinksFunction, MetaFunction } from '@remix-run/node'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from '@remix-run/react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { warmOfflineCache } from '~/lib/pwa'
import stylesheet from '~/tailwind.css?url'

export const meta: MetaFunction = () => [
  { title: 'ColorRecognizer' },
  {
    name: 'description',
    content:
      'Prenez une photo, prélevez une couleur et corrigez-la pour obtenir un code NCS, RVB et autres.',
  },
]

export const links: LinksFunction = () => {
  const base = import.meta.env.BASE_URL
  return [
    { rel: 'stylesheet', href: stylesheet },
    { rel: 'icon', href: `${base}favicon.svg`, type: 'image/svg+xml' },
    { rel: 'apple-touch-icon', href: `${base}apple-touch-icon.png`, sizes: '180x180' },
    { rel: 'manifest', href: `${base}site.webmanifest` },
  ]
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" style={{ backgroundColor: '#f3eee6' }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f3eee6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="ColorRecognizer" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <Meta />
        <Links />
        {import.meta.env.PROD ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){if(!('serviceWorker' in navigator))return;var b=${JSON.stringify(import.meta.env.BASE_URL)};navigator.serviceWorker.register(b+'sw.js',{scope:b}).catch(function(){})})();`,
            }}
          />
        ) : null}
      </head>
      <body style={{ margin: 0, backgroundColor: '#f3eee6', color: '#1a1a1a' }}>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  useEffect(() => {
    warmOfflineCache()
  }, [])

  return <Outlet />
}

export function HydrateFallback() {
  return (
    <p
      className="grid min-h-dvh place-items-center font-sans text-lg"
      style={{ margin: 0, backgroundColor: '#f3eee6', color: '#1a1a1a' }}
    >
      Chargement…
    </p>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()

  useEffect(() => {
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center" style={{ backgroundColor: '#f3eee6', color: '#1a1a1a' }}>
      <div>
        <h1 className="text-xl font-semibold">Quelque chose s'est mal passé</h1>
        <p className="mt-2">Rechargez la page pour reprendre la mesure.</p>
      </div>
    </main>
  )
}
