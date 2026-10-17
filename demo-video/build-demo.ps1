$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frames = Join-Path $root "frames"
$outDir = Join-Path $root "out"
$clips = Join-Path $root "clips"
New-Item -ItemType Directory -Force -Path $outDir, $clips | Out-Null

$W = 1920
$H = 1080
$FPS = 30
$DUR = 4.2

# caption text per clip (escaped for drawtext)
$scenes = @(
  @{ file = "00-title.jpg";   caption = "TURNAMEN BOLA";                 sub = "Demo aplikasi pendaftaran online"; zoom = "in" },
  @{ file = "01-home.png";    caption = "Landing page";                   sub = "Pendaftaran online siap dibuka"; zoom = "out" },
  @{ file = "02-dashboard.png"; caption = "Dashboard kapten";             sub = "Status tim dan jadwal pertandingan"; zoom = "in" },
  @{ file = "03-tim.png";     caption = "Transfer dan pembayaran";        sub = "Info rekening plus status konfirmasi"; zoom = "out" },
  @{ file = "04-pemain.png";  caption = "Data pemain dan berkas";         sub = "Form custom sesuai aturan admin"; zoom = "in" },
  @{ file = "05-bagan.png";   caption = "Bagan sistem gugur";             sub = "Acak lawan hingga juara"; zoom = "out" },
  @{ file = "06-mobile.png";  caption = "Tampilan mobile";                sub = "Menu dan bagan siap di HP"; zoom = "in" },
  @{ file = "07-promo-slide.png"; caption = "Alur lengkap";               sub = "Dari daftar sampai skor"; zoom = "out" },
  @{ file = "99-end.jpg";     caption = "Siap dipakai";                   sub = "Daftar kapten  Upload bukti  Bagan  Skor"; zoom = "in" }
)

$clipFiles = @()
$idx = 0
foreach ($s in $scenes) {
  $src = Join-Path $frames $s.file
  if (-not (Test-Path $src)) {
    Write-Host "SKIP missing $($s.file)"
    continue
  }
  $idx++
  $clip = Join-Path $clips ("clip_{0:D2}.mp4" -f $idx)
  $framesN = [int]($DUR * $FPS)

  # Ken Burns: slow zoom in or out every frame
  # Pakai ${H} supaya PowerShell tidak membaca $H:fps sebagai scope drive
  if ($s.zoom -eq "in") {
    $z = "zoompan=z='min(1.12,1+0.0009*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${framesN}:s=${W}x${H}:fps=${FPS}"
  } else {
    $z = "zoompan=z='if(eq(on,0),1.12,max(1.0,1.12-0.0009*on))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${framesN}:s=${W}x${H}:fps=${FPS}"
  }

  $cap = $s.caption -replace ":", "\:" -replace "'", ""
  $sub = $s.sub -replace ":", "\:" -replace "'", ""

  $vf = @(
    "scale=${W}:${H}:force_original_aspect_ratio=decrease",
    "pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x070b16",
    "setsar=1",
    $z,
    "eq=contrast=1.05:saturation=1.12:brightness=0.02",
    "vignette=PI/5",
    "drawbox=x=0:y=ih-150:w=iw:h=150:color=black@0.55:t=fill",
    "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='$cap':fontsize=48:fontcolor=white:x=60:y=h-120:shadowcolor=black@0.7:shadowx=2:shadowy=2",
    "drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='$sub':fontsize=28:fontcolor=0x38bdf8:x=60:y=h-65:shadowcolor=black@0.6:shadowx=1:shadowy=1",
    "fade=t=in:st=0:d=0.35",
    "fade=t=out:st=$([math]::Round($DUR-0.35,2)):d=0.35"
  ) -join ","

  Write-Host "Rendering $clip ..."
  & ffmpeg -y -loop 1 -i $src -vf $vf -t $DUR -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 18 $clip
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed on $($s.file)" }
  $clipFiles += $clip
}

# Concat with xfade chain
$concatList = Join-Path $clips "list.txt"
$clipFiles | ForEach-Object { "file '$($_ -replace '\\','/')'" } | Set-Content -Encoding ascii $concatList

# Simple concat first (reliable), then optional xfade if few clips
$out = Join-Path $outDir "turnamen-bola-demo.mp4"
Write-Host "Concatenating to $out ..."
& ffmpeg -y -f concat -safe 0 -i $concatList -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 -movflags +faststart $out
if ($LASTEXITCODE -ne 0) { throw "concat failed" }

# Build smoother xfade version
if ($clipFiles.Count -ge 2) {
  $xd = 0.55
  $inputs = @()
  for ($i = 0; $i -lt $clipFiles.Count; $i++) {
    $inputs += "-i"
    $inputs += $clipFiles[$i]
  }

  $filterParts = New-Object System.Collections.Generic.List[string]
  $offset = $DUR - $xd
  # Single-quoted supaya PowerShell tidak menganggap [0:v] sebagai indeks array
  $prev = '[0:v]'
  for ($i = 1; $i -lt $clipFiles.Count; $i++) {
    $outLabel = if ($i -eq $clipFiles.Count - 1) { '[vout]' } else { "[v$i]" }
    $curr = "[${i}:v]"
    $filterParts.Add("${prev}${curr}xfade=transition=fadeblack:duration=${xd}:offset=${offset}${outLabel}")
    $prev = $outLabel
    $offset += ($DUR - $xd)
  }
  $fc = ($filterParts -join ';')
  $outX = Join-Path $outDir "turnamen-bola-demo-fx.mp4"
  Write-Host "Building xfade version $outX ..."
  Write-Host $fc
  & ffmpeg -y @inputs -filter_complex $fc -map '[vout]' -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 -movflags +faststart $outX
  if ($LASTEXITCODE -eq 0) {
    Copy-Item $outX $out -Force
    Write-Host "OK FX -> $out"
  } else {
    Write-Host "xfade failed, keeping concat version"
  }
}

Write-Host "DONE: $out"
Get-Item $out | Format-List FullName, Length, LastWriteTime
