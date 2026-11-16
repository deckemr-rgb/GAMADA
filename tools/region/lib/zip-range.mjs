/**
 * zip-range.mjs — read single entries out of a remote ZIP with HTTP Range requests (no dependencies).
 * Used to pull one admin level out of the 450 MB HDX COD-AB archive without downloading all of it.
 */
import { inflateRawSync, createInflateRaw } from 'node:zlib'

async function range(url, start, end) {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } })
  if (res.status !== 206 && res.status !== 200) throw new Error(`range ${start}-${end}: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Resolve redirects once (HDX → signed S3 URL) and return { url, size }. */
export async function resolve(url) {
  const res = await fetch(url, { headers: { Range: 'bytes=0-0' }, redirect: 'follow' })
  const cr = res.headers.get('content-range') // bytes 0-0/12345
  const size = cr ? Number(cr.split('/')[1]) : Number(res.headers.get('content-length'))
  await res.arrayBuffer().catch(() => {})
  return { url: res.url, size }
}

/** List entries: [{ name, method, compSize, size, localOffset }] (supports ZIP64). */
export async function listEntries(url, size) {
  const tailLen = Math.min(size, 65557 + 20 + 56)
  const tail = await range(url, size - tailLen, size - 1)
  let eocd = -1
  for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('EOCD not found')
  let cdSize = tail.readUInt32LE(eocd + 12)
  let cdOff = tail.readUInt32LE(eocd + 16)
  let count = tail.readUInt16LE(eocd + 10)
  if (cdOff === 0xffffffff || cdSize === 0xffffffff || count === 0xffff) {
    const loc = eocd - 20
    if (tail.readUInt32LE(loc) !== 0x07064b50) throw new Error('ZIP64 locator not found')
    const z64off = Number(tail.readBigUInt64LE(loc + 8))
    const z = await range(url, z64off, z64off + 55)
    count = Number(z.readBigUInt64LE(32))
    cdSize = Number(z.readBigUInt64LE(40))
    cdOff = Number(z.readBigUInt64LE(48))
  }
  const cd = await range(url, cdOff, cdOff + cdSize - 1)
  const out = []
  let p = 0
  for (let n = 0; n < count; n++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central dir')
    const method = cd.readUInt16LE(p + 10)
    let compSize = cd.readUInt32LE(p + 20)
    let usize = cd.readUInt32LE(p + 24)
    const nameLen = cd.readUInt16LE(p + 28)
    const extraLen = cd.readUInt16LE(p + 30)
    const commLen = cd.readUInt16LE(p + 32)
    let localOffset = cd.readUInt32LE(p + 42)
    const name = cd.toString('utf8', p + 46, p + 46 + nameLen)
    let e = p + 46 + nameLen
    const eEnd = e + extraLen
    while (e + 4 <= eEnd) {
      const id = cd.readUInt16LE(e), len = cd.readUInt16LE(e + 2)
      if (id === 1) {
        let q = e + 4
        if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8 }
        if (compSize === 0xffffffff) { compSize = Number(cd.readBigUInt64LE(q)); q += 8 }
        if (localOffset === 0xffffffff) { localOffset = Number(cd.readBigUInt64LE(q)); q += 8 }
      }
      e += 4 + len
    }
    out.push({ name, method, compSize, size: usize, localOffset })
    p = eEnd + commLen
  }
  return out
}

/** Stream-inflate one entry; returns an async iterable of Buffers. */
export async function* streamEntry(url, entry) {
  const head = await range(url, entry.localOffset, entry.localOffset + 29)
  const dataStart = entry.localOffset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28)
  const res = await fetch(url, { headers: { Range: `bytes=${dataStart}-${dataStart + entry.compSize - 1}` } })
  if (!res.ok) throw new Error(`entry fetch HTTP ${res.status}`)
  if (entry.method === 0) { for await (const c of res.body) yield Buffer.from(c); return }
  if (entry.method !== 8) throw new Error(`unsupported zip method ${entry.method}`)
  const inf = createInflateRaw()
  const pump = (async () => { for await (const c of res.body) { if (!inf.write(Buffer.from(c))) await new Promise((r) => inf.once('drain', r)) } inf.end() })()
  for await (const c of inf) yield c
  await pump
}

export { inflateRawSync }
