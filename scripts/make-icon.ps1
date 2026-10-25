# Draws the LinkMystic icon (dark tile, neon gauge ring, "LM") as PNGs; scripts/pack-ico.js packs them into assets/icon.ico.
param([string]$Out = (Join-Path $PSScriptRoot '..\assets\icon-png'))
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $Out | Out-Null
foreach ($size in 256, 48, 32, 16) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::Transparent)
    $s = $size / 256.0
    $tile = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = 48 * $s; $w = $size - 1
    $tile.AddArc(0, 0, $r, $r, 180, 90); $tile.AddArc($w - $r, 0, $r, $r, 270, 90); $tile.AddArc($w - $r, $w - $r, $r, $r, 0, 90); $tile.AddArc(0, $w - $r, $r, $r, 90, 90); $tile.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 13, 15, 20))), $tile)
    $pw = [Math]::Max(2, 22 * $s); $m = 34 * $s
    $rect = New-Object System.Drawing.RectangleF($m, $m, ($size - 2 * $m), ($size - 2 * $m))
    $colors = @([System.Drawing.Color]::FromArgb(255, 0, 240, 255), [System.Drawing.Color]::FromArgb(255, 252, 238, 10), [System.Drawing.Color]::FromArgb(255, 255, 0, 60))
    for ($i = 0; $i -lt 3; $i++) {
        $pen = New-Object System.Drawing.Pen($colors[$i], $pw)
        $g.DrawArc($pen, $rect, 135 + $i * 90, 84)
        $pen.Dispose()
    }
    if ($size -ge 32) {
        $font = New-Object System.Drawing.Font('Segoe UI Black', [single](78 * $s), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
        $g.DrawString('LM', $font, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 252, 238, 10))), (New-Object System.Drawing.RectangleF(0, (6 * $s), $size, $size)), $fmt)
        $font.Dispose()
    }
    $g.Dispose()
    $bmp.Save((Join-Path $Out "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}
"icon PNGs written to $Out"
