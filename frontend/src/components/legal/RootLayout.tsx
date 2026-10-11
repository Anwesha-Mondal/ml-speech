import { Outlet } from 'react-router-dom'
import CookieBanner from './CookieBanner'

/** Wraps every route so the cookie banner appears on public and signed-in pages alike. */
export default function RootLayout() {
  return (
    <>
      <Outlet />
      <CookieBanner />
    </>
  )
}
