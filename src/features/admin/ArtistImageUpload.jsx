import { useEffect, useRef, useState } from 'react';
import ArtistImage from '../../components/ArtistImage.jsx';
import { artistImageService, validateArtistImage } from './artistImageService.js';

export default function ArtistImageUpload({ value, name, disabled, onUploaded, onBusy, service = artistImageService }) {
  const [file,setFile] = useState(null);
  const [preview,setPreview] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [failed,setFailed] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  },[file]);
  function select(event) {
    const selected = event.target.files?.[0]; setMessage(''); setFailed(false); setFile(null);
    if (!selected) return;
    const error = validateArtistImage(selected);
    if (error) { setMessage(error); event.target.value = ''; return; }
    setFile(selected);
  }
  async function upload() {
    if (!file || lock.current || disabled) return;
    lock.current = true; setBusy(true); onBusy(true); setMessage('');
    try { const result = await service.upload(file); onUploaded(result.url); setFile(null); setMessage('Ảnh đã được tải lên. Nhấn Lưu thay đổi để cập nhật nghệ sĩ.'); }
    catch { setMessage('Chưa thể tải ảnh lên. Vui lòng thử lại.'); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  return <section className="artist-upload" aria-label="Ảnh nghệ sĩ">
    <label htmlFor="artist-image-file">Tải ảnh nghệ sĩ lên</label>
    <input id="artist-image-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} onChange={select} aria-describedby="artist-image-help" />
    <p id="artist-image-help">JPEG, PNG hoặc WebP · Tối đa 5 MB. Ảnh cũ được giữ cho đến khi bạn lưu thay đổi.</p>
    <div className="artist-upload-preview">{preview ? <div className="artist-image-wrap">{failed ? <p className="artist-image-fallback flex items-center justify-center p-6 text-sm" role="alert">Không thể xem ảnh này. Vui lòng chọn tệp ảnh khác.</p> : <img src={preview} alt={'Xem trước ảnh mới của ' + (name || 'nghệ sĩ')} onError={() => setFailed(true)} />}</div> : <ArtistImage artist={{ name:name || 'nghệ sĩ',image_url:value }} />}</div>
    <button type="button" disabled={!file || busy || disabled || failed} onClick={upload}>{busy ? 'Đang tải ảnh lên...' : 'Tải ảnh lên'}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
