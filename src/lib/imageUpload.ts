import { ALLOWED_IMAGE_MIME, REVIEW_LIMITS, sniffImageType, type ReviewMedia } from './reviews'

export class UploadError extends Error {}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new UploadError('The image could not be read.'))
    img.src = url
  })

/**
 * Validate (declared type, size, real type via magic bytes) and downscale a review photo so it fits
 * browser storage. Videos are intentionally rejected: there is no server/object storage to hold them.
 */
export async function prepareReviewImage(file: File): Promise<ReviewMedia> {
  if (file.type.startsWith('video/')) throw new UploadError('Video uploads are not supported yet.')
  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) throw new UploadError('Only JPEG, PNG or WebP images are allowed.')
  if (file.size > REVIEW_LIMITS.maxImageBytes) throw new UploadError('Images must be 2 MB or smaller.')
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const real = sniffImageType(head)
  if (!real || real !== file.type) throw new UploadError('The file content does not match an allowed image type.')

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const scale = Math.min(1, 960 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new UploadError('The image could not be processed.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    let quality = 0.82
    let dataUrl = canvas.toDataURL('image/jpeg', quality)
    while (dataUrl.length * 0.75 > REVIEW_LIMITS.maxStoredMediaBytes && quality > 0.4) {
      quality -= 0.1
      dataUrl = canvas.toDataURL('image/jpeg', quality)
    }
    const size = Math.round(dataUrl.length * 0.75)
    if (size > REVIEW_LIMITS.maxStoredMediaBytes) throw new UploadError('The image is too large to store.')
    return {
      id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      kind: 'image',
      mime: 'image/jpeg',
      size,
      dataUrl,
      name: file.name.slice(0, 80),
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
