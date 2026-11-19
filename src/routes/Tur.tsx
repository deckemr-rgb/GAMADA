/**
 * /tur and /tur/:bab — the tour "Satu Hari di {region}" (spec §12, docs/build/tahap5-plan.md). Full screen (route
 * handle chrome 'none'). The body is src/demo-kit/tour/TourPage.tsx: opener (/tur), chapter poster (/tur/:bab),
 * player and summary. An unknown chapter redirects to /tur.
 */
import { Navigate, useLocation, useParams } from 'react-router'
import { parseChapter } from '../content/tour'
import TourPage from '../demo-kit/tour/TourPage'

export default function Tur() {
  const { bab } = useParams()
  const { search } = useLocation()
  const ch = parseChapter(bab)
  if (bab !== undefined && !ch) return <Navigate to={`/tur${search}`} replace />
  return <TourPage bab={ch?.n ?? null} />
}
