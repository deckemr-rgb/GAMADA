/**
 * Composer.tsx (lazy: the Dokumen tab) — the 7 sections of the bid document (34 pages). "Susun dengan AI" fills them
 * in a stagger (page counter 0 → 34; at once under reduced motion); each section shows Sebelum / Sesudah AI /
 * Bandingkan (TextDiff) and stays editable. The price list edits unit prices (MoneyInput) and re-runs the total +
 * terbilang; that total is the Surat amount and the bid.submitted price. Mission 'susun' when all 7 hold the AI text.
 */
import { Suspense, lazy, useMemo, useState } from 'react'
import { intentProps, markMission } from '../../demo-kit/shell'
import { TextDiff } from '../../demo-kit/docs/TextDiff'
import { terbilang } from '../../demo-kit/i18n/terbilang'
import { Button, Icon, LoadingText, MoneyInput, Segmented, Textarea, motionMode } from '../../demo-kit/ui'
import { useWorld, type WorldState } from '../../demo-kit/world'
import { SECTIONS, TOTAL_PAGES, composedCount, getDraft, pagesOf, setDraft, useDraft, type SectionId } from './draft'
import { SLUG, bidOf, rp } from './model'
import { SECTION_TITLE, docCtx, sectionText } from './sections'
import Send from './Send'
import { useDocT } from './strings-doc'

const loadPreview = () => import('./Preview')
const Preview = lazy(loadPreview)
const whole = (s: WorldState) => s
const STAGGER_MS = 260

/** fills the sections one by one (module scope: keeps going when the tab is left) */
const running = new Set<string>()
function compose(tenderId: string): void {
  if (running.has(tenderId)) return
  const todo = SECTIONS.filter((x) => !getDraft(tenderId).sections[x.id]?.ai).map((x) => x.id)
  const done = () => {
    running.delete(tenderId)
    if (composedCount(getDraft(tenderId)) === SECTIONS.length) markMission(SLUG, 'susun')
  }
  const put = (id: SectionId) => setDraft(tenderId, (d) => ({ sections: { ...d.sections, [id]: { ai: true } } }))
  if (!todo.length) return done()
  if (motionMode() !== 'full') {
    for (const id of todo) put(id)
    return done()
  }
  running.add(tenderId)
  todo.forEach((id, i) =>
    window.setTimeout(() => {
      put(id)
      if (i === todo.length - 1) done()
    }, (i + 1) * STAGGER_MS),
  )
}

export default function Composer({ tenderId, sm }: { tenderId: string; sm: boolean }) {
  const { d, lang } = useDocT()
  const s = useWorld(whole)
  const draft = useDraft(tenderId)
  const [open, setOpen] = useState<SectionId>('surat')
  const [view, setView] = useState<Record<string, 'before' | 'after' | 'diff'>>({})
  const [preview, setPreview] = useState(false)
  const [, kick] = useState(0)
  const tender = s.tenders.byId[tenderId]
  const bid = useMemo(() => bidOf(s, tenderId, draft), [s, tenderId, draft])
  const ctx = useMemo(() => (bid ? docCtx(s, tenderId, bid.target, draft.units) : null), [s, tenderId, bid, draft.units])
  if (!tender || !bid || !ctx) return <p className="dk-tp-empty">{d.noTender}</p>
  if (!tender.matches[s.meta.shopId] && !tender.items?.length) return <p className="dk-tp-empty">{d.noItems}</p>

  const n = composedCount(draft)
  const pages = pagesOf(draft)
  const busy = running.has(tenderId) && n < SECTIONS.length
  const textOf = (id: SectionId, ai: boolean) => (ai && draft.sections[id]?.text !== undefined ? draft.sections[id]!.text! : sectionText(id, ctx, lang, ai))

  return (
    <div className="dk-tp-doc" data-tender={tenderId}>
      <header className="dk-tp-doc-h">
        <div>
          <h2>{d.docTitle}</h2>
          <p className="dk-tp-muted">{d.docLead(tender.code)}</p>
        </div>
        <div className="dk-tp-doc-act">
          <span className="dk-tp-pages dk-num" data-tp="pages" data-pages={pages}>
            {d.pages(pages, TOTAL_PAGES)}
          </span>
          <span className="dk-sr" role="status" aria-live="polite">
            {n === SECTIONS.length ? d.pagesSr(pages) : ''}
          </span>
          <Button variant={n === SECTIONS.length ? 'secondary' : 'primary'} icon="spark" busy={busy} disabled={n === SECTIONS.length} onClick={() => {
              compose(tenderId)
              kick((k) => k + 1)
            }}
            data-tp="compose">
            {n === SECTIONS.length ? d.composed : busy ? d.composing : d.compose}
          </Button>
          <Button variant="ghost" icon="eye" onClick={() => setPreview(true)} {...intentProps(loadPreview)} data-tp="preview">
            {d.preview}
          </Button>
        </div>
      </header>
      <span className="dk-tp-progress" aria-hidden="true">
        <i style={{ transform: `scaleX(${pages / TOTAL_PAGES})` }} />
      </span>

      <ol className="dk-tp-secs">
        {SECTIONS.map((sec) => {
          const st = draft.sections[sec.id]
          const ai = !!st?.ai
          const title = SECTION_TITLE[sec.id][lang]
          const isOpen = open === sec.id
          const v = ai ? (view[sec.id] ?? 'after') : 'before'
          return (
            <li key={sec.id} className={`dk-tp-sec${ai ? ' is-ai' : ''}${isOpen ? ' is-open' : ''}`} data-sec={sec.id} data-ai={ai ? '1' : '0'}>
              <h3 className="dk-tp-sec-h">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? ('' as SectionId) : sec.id)}>
                  <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size={16} />
                  <span className="dk-tp-sec-title">{title}</span>
                  <span className="dk-tp-sec-pages">{d.sectionPages(sec.pages)}</span>
                  {ai && <span className="dk-tp-tag is-ai">{st?.text !== undefined ? `${d.aiBadge} · ${d.edited}` : d.aiBadge}</span>}
                </button>
              </h3>
              {isOpen && (
                <div className="dk-tp-sec-body">
                  {ai && (
                    <Segmented
                      size="sm"
                      label={title}
                      value={v}
                      onChange={(x) => setView((m) => ({ ...m, [sec.id]: x }))}
                      options={[
                        { value: 'before', label: d.before },
                        { value: 'after', label: d.after },
                        { value: 'diff', label: d.diff },
                      ]}
                    />
                  )}
                  {v === 'diff' ? (
                    <TextDiff before={sectionText(sec.id, ctx, lang, false)} after={textOf(sec.id, true)} mode="inline" label={d.diffLabel(title)} />
                  ) : v === 'before' ? (
                    <pre className="dk-tp-pre">{sectionText(sec.id, ctx, lang, false)}</pre>
                  ) : (
                    <Textarea
                      aria-label={d.edit(title)}
                      value={textOf(sec.id, true)}
                      rows={sm ? 9 : 8}
                      onChange={(e) => {
                        const text = e.target.value
                        setDraft(tenderId, (x) => ({ sections: { ...x.sections, [sec.id]: { ai: true, text } } }))
                      }}
                    />
                  )}
                  {sec.id === 'harga' && (
                    <div className="dk-tp-lines">
                      {bid.lines.map((l, i) => (
                        <label key={i} className="dk-tp-line">
                          <span>
                            {l.name[lang]} · {l.qty.toLocaleString('id-ID')} {l.unit}
                          </span>
                          <MoneyInput
                            aria-label={d.unitPrice(l.name[lang])}
                            value={l.price}
                            onChange={(val) => setDraft(tenderId, (x) => ({ units: { ...bid.lines.reduce<Record<number, number>>((m, ln, j) => ((m[j] = x.units[j] ?? ln.price), m), {}), [i]: val ?? 0 } }))}
                          />
                          <span className="dk-num">{rp(l.total)}</span>
                        </label>
                      ))}
                      <p className="dk-tp-total">
                        <span>{d.totalLine}</span>
                        <strong className="dk-num" data-tp="doc-total">
                          {rp(bid.total)}
                        </strong>
                      </p>
                      <p className="dk-tp-words" data-tp="terbilang">
                        {d.inWords}: {terbilang(bid.total, lang)} {d.rupiah}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <Send tenderId={tenderId} total={bid.total} />

      {preview && (
        <Suspense fallback={<LoadingText>{d.composing}</LoadingText>}>
          <Preview open={preview} onClose={() => setPreview(false)} tenderId={tenderId} ctx={ctx} textOf={(id) => textOf(id, !!draft.sections[id]?.ai)} sm={sm} />
        </Suspense>
      )}
    </div>
  )
}
