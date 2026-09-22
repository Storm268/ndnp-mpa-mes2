'use client'
import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'

interface Props {
  value:            string[]                     // uploaded public URLs
  onChange:         (urls: string[]) => void
  maxPhotos?:       number
  bucket?:          string
  /** Called with base64 data-URIs for offline storage (when upload is deferred) */
  onOfflineBlobs?:  (blobs: string[]) => void
}

export default function PhotoCapture({
  value = [], onChange, maxPhotos = 5, bucket = 'report-photos', onOfflineBlobs,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const [offlineCount, setOfflineCount] = useState(0)
  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const offlineBlobsRef = useRef<string[]>([])  // accumulate offline blobs

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    if (value.length + offlineCount >= maxPhotos) {
      setError(`Maximum ${maxPhotos} photos allowed.`)
      return
    }
    setUploading(true); setError('')
    const isOnline = navigator.onLine

    // Compress all selected files first
    const toProcess = Array.from(files).slice(0, maxPhotos - value.length - offlineCount)

    for (const file of toProcess) {
      try {
        let compressed: Blob = file
        if (file.size > 500 * 1024) {
          compressed = await imageCompression(file, {
            maxSizeMB: 2, maxWidthOrHeight: 1920,
            useWebWorker: true, fileType: 'image/jpeg',
          })
        }

        if (isOnline) {
          // ─ Upload immediately to Supabase Storage ──────────────────────────
          const supabase = createClient()
          const path     = `reports/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
          const { data, error: uploadErr } = await supabase.storage
            .from(bucket)
            .upload(path, compressed, { contentType:'image/jpeg', upsert:false })

          if (uploadErr) { setError(uploadErr.message); continue }
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
          onChange([...value, urlData.publicUrl])
        } else {
          // ─ Offline: store as base64 data-URI in memory ─────────────────────
          const dataUri = await blobToDataUri(compressed)
          offlineBlobsRef.current.push(dataUri)
          setOfflineCount(offlineBlobsRef.current.length)
          onOfflineBlobs?.(offlineBlobsRef.current)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    }
    setUploading(false)
  }

  function removeUrl(url: string) {
    onChange(value.filter(u => u !== url))
  }

  function removeBlob(index: number) {
    offlineBlobsRef.current = offlineBlobsRef.current.filter((_, i) => i !== index)
    setOfflineCount(offlineBlobsRef.current.length)
    onOfflineBlobs?.(offlineBlobsRef.current)
  }

  const totalCount = value.length + offlineCount
  const canAdd     = totalCount < maxPhotos && !uploading

  return (
    <div>
      <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#7aa3be', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>
        Photos
        <span style={{ color:'#3d6b84', fontWeight:400, textTransform:'none', letterSpacing:0, marginLeft:'4px' }}>({totalCount}/{maxPhotos})</span>
        {offlineCount > 0 && (
          <span style={{ marginLeft:'8px', fontSize:'10px', fontWeight:'700', padding:'1px 6px', borderRadius:'8px', background:'rgba(245,158,11,0.15)', color:'#fbbf24', border:'1px solid rgba(245,158,11,0.3)' }}>
            {offlineCount} offline
          </span>
        )}
      </label>

      {/* Uploaded thumbnails */}
      {value.length > 0 && (
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>
          {value.map(url => (
            <div key={url} style={{ position:'relative', width:'80px', height:'80px', borderRadius:'8px', overflow:'hidden', border:'1px solid rgba(0,188,212,0.3)', flexShrink:0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Photo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              <button type="button" onClick={() => removeUrl(url)}
                style={{ position:'absolute', top:'3px', right:'3px', width:'18px', height:'18px', borderRadius:'50%', background:'rgba(0,0,0,0.75)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Offline blob thumbnails */}
      {offlineCount > 0 && (
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>
          {offlineBlobsRef.current.map((blob, i) => (
            <div key={i} style={{ position:'relative', width:'80px', height:'80px', borderRadius:'8px', overflow:'hidden', border:'1px solid rgba(245,158,11,0.4)', flexShrink:0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={blob} alt="Offline photo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(245,158,11,0.85)', fontSize:'9px', fontWeight:'700', color:'#000', textAlign:'center', padding:'2px 0' }}>OFFLINE</div>
              <button type="button" onClick={() => removeBlob(i)}
                style={{ position:'absolute', top:'3px', right:'3px', width:'18px', height:'18px', borderRadius:'50%', background:'rgba(0,0,0,0.75)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add photo buttons */}
      {canAdd && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
          <button type="button" onClick={() => cameraRef.current?.click()}
            style={{ padding:'12px 10px', border:'1px dashed rgba(0,188,212,0.4)', borderRadius:'8px', background:'rgba(0,188,212,0.05)', color:'#00bcd4', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', fontFamily:'inherit' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
            <span style={{ fontSize:'12px', fontWeight:'600' }}>Take Photo</span>
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()}
            style={{ padding:'12px 10px', border:'1px dashed rgba(255,255,255,0.15)', borderRadius:'8px', background:'rgba(255,255,255,0.03)', color:'#7aa3be', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', fontFamily:'inherit' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <span style={{ fontSize:'12px', fontWeight:'600' }}>From Gallery</span>
          </button>
        </div>
      )}

      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" multiple={false} style={{ display:'none' }} onChange={e => handleFiles(e.target.files)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e => handleFiles(e.target.files)} />

      {uploading && (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px', fontSize:'13px', color:'#00bcd4' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-18 0"/></svg>
          {navigator.onLine ? 'Uploading photo…' : 'Saving photo offline…'}
        </div>
      )}
      {error && (
        <div style={{ marginTop:'8px', padding:'8px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'6px', fontSize:'12px', color:'#f87171' }}>
          {error}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// Helper: Blob → base64 data-URI
function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

