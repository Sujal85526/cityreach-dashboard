import type { StoredDocument } from '@dm/shared'

/** A file made ready for storage: the bytes to keep and how to turn them back into the file. */
export interface Packed {
  bytes: Uint8Array
  encoding: StoredDocument['encoding']
  mimeType: string
  fileName: string
}

/** Photos and scans are re-saved at this longest side; enough to read any paperwork. */
const PHOTO_MAX_PX = 2400
const PHOTO_QUALITY = 0.82
/** Keep the smaller version only when it saves at least 5 %. */
const WORTH_IT = 0.95

const streamBytes = async (stream: ReadableStream<Uint8Array>) =>
  new Uint8Array(await new Response(stream).arrayBuffer())

const gzip = (data: Uint8Array) =>
  streamBytes(new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('gzip')))

const gunzip = (data: Uint8Array) =>
  streamBytes(new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip')))

/** A photo re-saved as a JPEG no larger than PHOTO_MAX_PX, on white (paperwork has no transparency). */
async function shrinkPhoto(file: File): Promise<Blob | null> {
  try {
    const image = await createImageBitmap(file)
    const scale = Math.min(1, PHOTO_MAX_PX / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    image.close()
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY))
  } catch {
    return null // a format the browser can't draw (e.g. some HEIC): stored as it is
  }
}

const withExtension = (name: string, ext: string) => `${name.replace(/\.[^.]+$/, '')}.${ext}`

/**
 * Makes a file smaller before storing it: photos are re-saved as a JPEG, everything else
 * (PDF, Word…) is gzipped. Whichever is smallest wins; a file that doesn't shrink is kept as is.
 * Example: a 4.2 MB phone photo of a contract → ≈ 0.6 MB; a 1.1 MB PDF → ≈ 0.9 MB.
 */
export async function pack(file: File): Promise<Packed> {
  const raw = new Uint8Array(await file.arrayBuffer())
  const original: Packed = {
    bytes: raw,
    encoding: 'none',
    mimeType: file.type || 'application/octet-stream',
    fileName: file.name,
  }
  if (file.type.startsWith('image/') && file.type !== 'image/gif') {
    const photo = await shrinkPhoto(file)
    if (photo && photo.size < raw.length * WORTH_IT)
      return {
        bytes: new Uint8Array(await photo.arrayBuffer()),
        encoding: 'jpeg',
        mimeType: 'image/jpeg',
        fileName: withExtension(file.name, 'jpg'),
      }
    return original
  }
  if (typeof CompressionStream === 'undefined') return original
  const zipped = await gzip(raw)
  return zipped.length < raw.length * WORTH_IT
    ? { ...original, bytes: zipped, encoding: 'gzip' }
    : original
}

/** The stored bytes back as the file. */
export async function unpack(
  bytes: Uint8Array,
  doc: Pick<StoredDocument, 'encoding' | 'mimeType'>,
): Promise<Blob> {
  const data = doc.encoding === 'gzip' ? await gunzip(bytes) : bytes
  return new Blob([data as BlobPart], { type: doc.mimeType })
}

/** 1.3 MB, 640 KB, 0 KB */
export const formatBytes = (n: number) =>
  n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${n === 0 ? 0 : Math.max(1, Math.round(n / 1024))} KB`
