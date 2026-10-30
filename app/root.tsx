import type { LinksFunction, MetaFunction } from '@remix-run/node'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from '@remix-run/react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import stylesheet from '~/tailwind.css?url'

export const meta: MetaFunction = () => [
  { title: 'ColorRecognizer' },
  {
    name: 'description',
    content:
      'Photographiez une surface, prélevez une couleur et corrigez-la pour obtenir un code NCS, RVB et autres.',
  },
]

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: stylesheet },
  { rel: 'icon', href: `${import.meta.env.BASE_URL}favicon.svg`, type: 'image/svg+xml' },
]

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#6f6f6f" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function HydrateFallback() {
  return <p className="grid min-h-dvh place-items-center font-sans text-neutral-100">Chargement…</p>
}

export function ErrorBoundary() {
  const error = useRouteError()

  useEffect(() => {
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center text-white">
      <h1 className="text-xl font-semibold">Quelque chose s'est mal passé</h1>
      <p className="mt-2 text-neutral-200">Rechargez la page pour reprendre la mesure.</p>
    </main>
  )
}
