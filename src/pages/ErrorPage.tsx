import { Link, isRouteErrorResponse, useRouteError } from 'react-router'

/** Shown instead of a blank screen if a page crashes. */
export function ErrorPage() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="label text-accent">{notFound ? '404 · Page not found' : 'Something went wrong'}</p>
      <h1 className="display text-display-lg">{notFound ? 'This page doesn’t exist.' : 'This page hit a snag.'}</h1>
      <p className="max-w-md text-dim">
        {notFound ? 'Check the address, or head back home.' : 'Try reloading. If it keeps happening, the rest of the site still works.'}
      </p>
      <div className="flex gap-3">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <Link to="/" className="btn">
          Back to NFTrium
        </Link>
      </div>
    </main>
  )
}
