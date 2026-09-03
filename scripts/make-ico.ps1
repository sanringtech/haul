# Builds backend/app.ico from the exported PNG set using classic DIB entries.
#
# Do NOT switch this back to embedding PNG data. PNG-compressed ICO entries are
# only reliably supported at 256x256; at smaller sizes the PE resource compiler
# and Explorer's icon reader both mis-parse them, which is why the taskbar and
# file manager fell back to the generic icon even though the runtime
# WM_SETICON path (which goes through CreateIconFromResourceEx) looked correct.

Add-Type -AssemblyName System.Drawing

$SrcDir = if ($args[0]) { $args[0] } else { 'C:\Users\jack7\Downloads\haul\assets' }
$Out = if ($args[1]) { $args[1] } else { 'C:\Users\jack7\Projects\haul\backend\app.ico' }
$Sizes = @(16, 32, 48, 64, 128, 256)

function Get-DibEntry([int]$size, [string]$srcPath) {
    $img = [System.Drawing.Image]::FromFile($srcPath)
    try {
        # Normalise to exactly $size x $size 32bpp ARGB.
        $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = if ($img.Width -eq $size) { 'NearestNeighbor' } else { 'HighQualityBicubic' }
        $g.PixelOffsetMode = 'HighQuality'
        $g.DrawImage($img, 0, 0, $size, $size)
        $g.Dispose()
    } finally {
        $img.Dispose()
    }

    try {
        $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
        $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $stride = [Math]::Abs($data.Stride)
        $pixels = New-Object byte[] ($stride * $size)
        [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $pixels.Length)
        $bmp.UnlockBits($data)
    } finally {
        $bmp.Dispose()
    }

    $maskStride = [Math]::Floor(($size + 31) / 32) * 4
    $xorSize = $stride * $size
    $andSize = $maskStride * $size

    $ms = New-Object System.IO.MemoryStream
    $w = New-Object System.IO.BinaryWriter $ms

    # BITMAPINFOHEADER. biHeight is doubled to cover XOR image + AND mask.
    $w.Write([uint32]40)
    $w.Write([int32]$size)
    $w.Write([int32]($size * 2))
    $w.Write([uint16]1)
    $w.Write([uint16]32)
    $w.Write([uint32]0)   # BI_RGB
    $w.Write([uint32]($xorSize + $andSize))
    $w.Write([int32]0); $w.Write([int32]0)
    $w.Write([uint32]0); $w.Write([uint32]0)

    # DIB rows are stored bottom-up.
    for ($y = $size - 1; $y -ge 0; $y--) {
        $w.Write($pixels, $y * $stride, $stride)
    }
    # AND mask: all zero, alpha channel above carries transparency.
    $w.Write((New-Object byte[] $andSize), 0, $andSize)

    $w.Flush()
    $bytes = $ms.ToArray()
    $w.Dispose(); $ms.Dispose()
    return $bytes
}

$entries = foreach ($size in $Sizes) {
    # Use the exported PNG whose native size matches, else the next one up.
    $exact = Join-Path $SrcDir "haul-$size.png"
    $src = if (Test-Path $exact) { $exact } else { Join-Path $SrcDir 'haul-512.png' }
    [pscustomobject]@{ Size = $size; Data = (Get-DibEntry $size $src) }
}

$DIR_SIZE = 6
$ENTRY_SIZE = 16
$headerLen = $DIR_SIZE + $ENTRY_SIZE * $entries.Count

$ms = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $ms
$w.Write([uint16]0)                 # reserved
$w.Write([uint16]1)                 # type 1 = icon
$w.Write([uint16]$entries.Count)

$offset = $headerLen
foreach ($e in $entries) {
    $w.Write([byte]$(if ($e.Size -ge 256) { 0 } else { $e.Size }))
    $w.Write([byte]$(if ($e.Size -ge 256) { 0 } else { $e.Size }))
    $w.Write([byte]0)               # palette entries
    $w.Write([byte]0)               # reserved
    $w.Write([uint16]1)             # color planes
    $w.Write([uint16]32)            # bits per pixel
    $w.Write([uint32]$e.Data.Length)
    $w.Write([uint32]$offset)
    $offset += $e.Data.Length
}
foreach ($e in $entries) { $w.Write($e.Data, 0, $e.Data.Length) }

$w.Flush()
[System.IO.File]::WriteAllBytes($Out, $ms.ToArray())
$len = (Get-Item $Out).Length
$w.Dispose(); $ms.Dispose()

Write-Output "wrote $Out ($len bytes, sizes: $($Sizes -join ', '))"
