/**
 * Preview.tsx (lazy) — "Lihat halaman": the bid document on paper (PaperFrame) in a full-height Drawer; on phones the
 * sheet is scaled with transform: scale(). "Cetak / Simpan PDF" prints only the PaperFrame (printPaper).
 */
import { useRef } from 'react'
import { PaperFrame, printPaper } from '../../demo-kit/frames'
import { Button, Drawer } from '../../demo-kit/ui'
import { SECTIONS, type SectionId } from './draft'
import { SECTION_TITLE, type DocCtx } from './sections'
import { useDocT } from './strings-doc'

export default function Preview({ open, onClose, ctx, textOf, sm }: { open: boolean; onClose: () => void; tenderId: string; ctx: DocCtx; textOf: (id: SectionId) => string; sm: boolean }) {
  const { d, lang } = useDocT()
  const paper = useRef<HTMLDivElement>(null)
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={d.previewTitle}
      eyebrow={ctx.code}
      width={sm ? undefined : 720}
      className="dk-tp-preview-ov"
      footer={
        <Button variant="primary" icon="print" onClick={() => paper.current && printPaper(paper.current.querySelector('.dk-paper') ?? paper.current)} data-tp="print">
          {d.print}
        </Button>
      }
    >
      <div className="dk-tp-preview" data-lenis-prevent>
        <div ref={paper} className="dk-tp-preview-scale">
          <PaperFrame label={d.paperLabel(ctx.code)} size="auto">
            <p className="dk-tp-paper-mark">{d.specimen}</p>
            <h2 className="dk-tp-paper-title">
              {ctx.biz} · {ctx.title[lang]}
            </h2>
            {SECTIONS.map((sec) => (
              <section key={sec.id} className="dk-tp-paper-sec">
                <h3>
                  {SECTION_TITLE[sec.id][lang]} <small>({d.sectionPages(sec.pages)})</small>
                </h3>
                <pre>{textOf(sec.id)}</pre>
              </section>
            ))}
          </PaperFrame>
        </div>
      </div>
    </Drawer>
  )
}
