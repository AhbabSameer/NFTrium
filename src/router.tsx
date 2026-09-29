import { createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'
import { CreatePage } from './pages/CreatePage'
import { ErrorPage } from './pages/ErrorPage'
import { ExplorePage } from './pages/ExplorePage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { TokenPage } from './pages/TokenPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'token/:id', element: <TokenPage /> },
      { path: 'create', element: <CreatePage /> },
      { path: 'profile/:address?', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
