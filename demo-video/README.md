# Demo video MekarJaya Turnamen

## File utama
- **Video:** `out/turnamen-bola-demo.mp4` (1920×1080, H.264)
- **Promo interaktif:** buka di browser `http://localhost:3000/demo-video/promo.html`

## Efek di video
- Ken Burns (zoom in/out) tiap adegan
- Color grade + vignette
- Caption judul + subtitle
- Fade in/out per klip
- Transisi fade-to-black antar adegan

## Render ulang
```powershell
powershell -ExecutionPolicy Bypass -File demo-video/build-demo.ps1
```

Butuh `ffmpeg` di PATH.
