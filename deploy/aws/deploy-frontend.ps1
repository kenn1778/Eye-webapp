# Build the Vite app and publish it to S3 + CloudFront.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File deploy\aws\deploy-frontend.ps1
#   powershell ... -File deploy\aws\deploy-frontend.ps1 -Bucket my-bucket -DistributionId EXXXXXXXXXXXXX

param(
  [string]$Bucket = "eye-scholarship-frontend-771675725169",
  [string]$DistributionId = "E2MCF24M6PZ89T",
  [string]$Domain = "d3dbr7cazt88p7.cloudfront.net",
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$frontend = Join-Path $root "frontend"
$dist = Join-Path $frontend "dist"

Push-Location $frontend
try {
  Write-Host "[1/5] building frontend"
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }

  Write-Host "[2/5] uploading hashed assets (immutable, 1 year; old versions kept so cached index.html never 404s)"
  aws s3 sync (Join-Path $dist "assets") "s3://$Bucket/assets" `
    --cache-control "public,max-age=31536000,immutable" --region $Region
  if ($LASTEXITCODE -ne 0) { throw "asset upload failed" }

  Write-Host "[3/5] uploading index.html and static files (5 min cache)"
  aws s3 sync $dist "s3://$Bucket" `
    --exclude "assets/*" --cache-control "public,max-age=300" --region $Region
  if ($LASTEXITCODE -ne 0) { throw "static upload failed" }

  # The backend serves /story/:id from this shell (with per-story Open Graph
  # tags injected), so crawlers boxing a story link get the real app page.
  Write-Host "[4/5] publishing index.html to the API host for story previews"
  $details = aws lightsail get-instance-access-details `
    --instance-name "eye-api" --region $Region --protocol ssh --output json | ConvertFrom-Json
  if (-not $details.accessDetails) { throw "could not read Lightsail access details" }
  $tempKey = Join-Path ([IO.Path]::GetTempPath()) ("eye-frontend-" + [guid]::NewGuid().ToString("N") + ".pem")
  [IO.File]::WriteAllText($tempKey, $details.accessDetails.privateKey)
  # Lightsail keys only work when the certificate sits beside the private key.
  [IO.File]::WriteAllText("$tempKey-cert.pub", $details.accessDetails.certKey)
  icacls $tempKey /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
  $hostIp = $details.accessDetails.ipAddress
  try {
    ssh -i $tempKey -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "ubuntu@$hostIp" "mkdir -p /opt/eye/backend/view"
    if ($LASTEXITCODE -ne 0) { throw "making view directory failed" }
    scp -i $tempKey -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null `
      (Join-Path $dist "index.html") "ubuntu@${hostIp}:/opt/eye/backend/view/index.html"
    if ($LASTEXITCODE -ne 0) { throw "index.html upload failed" }
  }
  finally {
    Remove-Item -LiteralPath $tempKey -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath "$tempKey-cert.pub" -Force -ErrorAction SilentlyContinue
  }

  Write-Host "[5/5] invalidating CloudFront"
  aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation failed" }
}
finally {
  Pop-Location
}

Write-Host "Frontend deployed: https://$Domain"
