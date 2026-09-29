import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-6 px-4 pt-24 text-center">
      <p className="label text-accent">404 · Page not found</p>
      <h1 className="display text-display-lg">This page doesn’t exist.</h1>
      <Link to="/" className="btn">
        Back to NFTrium
      </Link>
    </div>
  )
}
