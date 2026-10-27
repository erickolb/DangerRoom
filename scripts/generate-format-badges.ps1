Add-Type -AssemblyName System.Drawing
foreach($text in @('TPB','HC','OMNI')){
  $letters=[System.Drawing.Drawing2D.GraphicsPath]::new()
  $family=[System.Drawing.FontFamily]::new('Arial Black')
  $letters.AddString($text,$family,0,60,[System.Drawing.PointF]::new(0,0),[System.Drawing.StringFormat]::GenericTypographic)
  $bounds=$letters.GetBounds();$badgeHeight=64;$badgeWidth=[int][Math]::Ceiling($bounds.Width+24);$radius=8
  $transform=[System.Drawing.Drawing2D.Matrix]::new();$transform.Translate([single](12-$bounds.Left),[single](($badgeHeight-$bounds.Height)/2-$bounds.Top));$letters.Transform($transform)
  $shape=[System.Drawing.Drawing2D.GraphicsPath]::new([System.Drawing.Drawing2D.FillMode]::Alternate)
  $shape.AddArc(0,0,$radius*2,$radius*2,180,90);$shape.AddArc($badgeWidth-$radius*2,0,$radius*2,$radius*2,270,90);$shape.AddArc($badgeWidth-$radius*2,$badgeHeight-$radius*2,$radius*2,$radius*2,0,90);$shape.AddArc(0,$badgeHeight-$radius*2,$radius*2,$radius*2,90,90);$shape.CloseFigure();$shape.AddPath($letters,$false)
  $bitmap=[System.Drawing.Bitmap]::new($badgeWidth*4,$badgeHeight*4,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics=[System.Drawing.Graphics]::FromImage($bitmap);$graphics.Clear([System.Drawing.Color]::Transparent);$graphics.ScaleTransform(4,4);$graphics.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias;$graphics.FillPath([System.Drawing.Brushes]::White,$shape)
  $destination=Join-Path $PSScriptRoot "../public/format-$($text.ToLower()).png";$bitmap.Save([System.IO.Path]::GetFullPath($destination),[System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose();$bitmap.Dispose();$shape.Dispose();$letters.Dispose();$transform.Dispose();$family.Dispose()
}
