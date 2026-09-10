import { supabase } from '../../lib/supabase.js';
import { safePublicUrl } from '../../utils/concert.js';
export const ARTIST_IMAGE_BUCKET = 'artist-images';
export const MAX_ARTIST_IMAGE_BYTES = 5 * 1024 * 1024;
const extensions = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
export function validateArtistImage(file) {
  if (!file || !extensions[file.type] || !Number.isFinite(file.size) || file.size <= 0) return 'Tệp ảnh không hợp lệ. Chọn ảnh JPEG, PNG hoặc WebP.';
  if (file.size > MAX_ARTIST_IMAGE_BYTES) return 'Ảnh vượt quá dung lượng cho phép (5 MB).';
  return '';
}
export function artistImagePath(file, uuid = globalThis.crypto.randomUUID()) {
  if (validateArtistImage(file) || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(uuid)) throw new Error('Invalid image');
  return `artists/${uuid.toLowerCase()}.${extensions[file.type]}`;
}
export function createArtistImageService(client = supabase) {
  return {
    async upload(file) {
      const invalid = validateArtistImage(file);
      if (invalid) throw new Error(invalid);
      try {
        if (!client) throw new Error();
        const bucket = client.storage.from(ARTIST_IMAGE_BUCKET);
        const path = artistImagePath(file);
        const { data, error } = await bucket.upload(path,file,{ contentType:file.type,cacheControl:'3600',upsert:false });
        if (error) throw error;
        if (!data?.path) throw new Error();
        const url = safePublicUrl(bucket.getPublicUrl(data.path).data?.publicUrl);
        if (!url) throw new Error();
        return { path:data.path,url };
      } catch { throw new Error('Chưa thể tải ảnh lên. Vui lòng thử lại.'); }
    },
  };
}
export const artistImageService = createArtistImageService();
