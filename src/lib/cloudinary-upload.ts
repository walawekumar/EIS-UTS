export type CloudinaryUploadResult = {
  url: string
  publicId: string
  bytes: number
  format: string
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() &&
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim(),
  )
}

export async function uploadToCloudinary(
  file: File,
): Promise<CloudinaryUploadResult> {
  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim()
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim()
  if (!cloud || !preset) {
    throw new Error('Cloudinary belum dikonfigurasi.')
  }
  const folder =
    import.meta.env.VITE_CLOUDINARY_FOLDER?.trim() || 'egabah'

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', preset)
  body.append('folder', folder)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`,
    { method: 'POST', body },
  )
  const json = (await res.json()) as {
    secure_url?: string
    public_id?: string
    bytes?: number
    format?: string
    error?: { message?: string }
  }
  if (!res.ok || !json.secure_url) {
    throw new Error(json.error?.message || 'Upload Cloudinary gagal.')
  }
  return {
    url: json.secure_url,
    publicId: json.public_id ?? '',
    bytes: json.bytes ?? file.size,
    format: json.format ?? '',
  }
}
