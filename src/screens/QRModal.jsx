import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// Full-screen modal showing a scannable QR code for the given URL.
export default function QRModal({ url, title, subtitle, onClose }) {
  const [dataUrl, setDataUrl] = useState(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, {
      width: 480,
      margin: 2,
      color: { dark: '#0b0e1a', light: '#ffffff' }
    }).then((d) => {
      if (!cancelled) setDataUrl(d)
    })
    return () => { cancelled = true }
  }, [url])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="qr-title" onClick={onClose}>
      <div className="modal-card qr-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="qr-title">{title}</h2>
        {subtitle && <p className="hint">{subtitle}</p>}
        <div className="qr-frame">
          {dataUrl ? <img className="qr-img" src={dataUrl} alt={`QR code for ${url}`} /> : <div className="spinner" />}
        </div>
        <button className="btn ghost" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
