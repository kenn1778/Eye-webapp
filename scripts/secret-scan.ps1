# Scan tracked files for credential-shaped strings. Never prints values,
# only file:line + matched key name context (mask secret-like tails).
param()
$tracked = git ls-files
$patterns = @(
  '(?i)(api[_-]?key|secret|token|password|passwd|pwd|private[_-]?key|authorization)\s*[:=]\s*[`"'']?[A-Za-z0-9+/_\-]{12,}',
  '(?i)(AKIA|ASIA)[0-9A-Z]{16}',
  '(?i)-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----',
  '(?i)x-origin-verify\s*[:=]',
  '(?i)gh[pousr]_[A-Za-z0-9]{20,}',
  '(?i)sk-[A-Za-z0-9]{20,}',
  '(?i)database_url\s*[:=]\s*post(gres|gresql)://'
)
$hits = 0
foreach ($f in $tracked) {
  if ($f -match '\.(png|jpg|jpeg|gif|ico|woff2?|pdf|zip)$') { continue }
  $path = Join-Path (Get-Location) $f
  if (-not (Test-Path $path)) { continue }
  $lines = Get-Content $path -ErrorAction SilentlyContinue
  for ($i = 0; $i -lt $lines.Count; $i++) {
    foreach ($p in $patterns) {
      $m = [regex]::Match($lines[$i], $p)
      if ($m.Success) {
        $preview = $lines[$i].Trim()
        if ($preview.Length -gt 90) { $preview = $preview.Substring(0, 90) + "..." }
        $masked = [regex]::Replace($preview, '(?<=[A-Za-z0-9+/_\-])[A-Za-z0-9+/_\-]{10,}(?=\s*$|[`"'',;\s])', '***MASKED***')
        Write-Output "$f`:$($i+1): $masked"
        $hits++
        if ($hits -gt 40) { Write-Output "(stopping: too many hits)"; exit 0 }
      }
    }
  }
}
Write-Output "total hits: $hits"
