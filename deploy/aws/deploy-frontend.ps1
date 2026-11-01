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
  Write-Host "[1/4] building frontend"
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }

  Write-Host "[2/4] uploading hashed assets (immutable, 1 year; old versions kept so cached index.html never 404s)"
  aws s3 sync (Join-Path $dist "assets") "s3://$Bucket/assets" `
    --cache-control "public,max-age=31536000,immutable" --region $Region
  if ($LASTEXITCODE -ne 0) { throw "asset upload failed" }

  Write-Host "[3/4] uploading index.html and static files (5 min cache)"
  aws s3 sync $dist "s3://$Bucket" `
    --exclude "assets/*" --cache-control "public,max-age=300" --region $Region
  if ($LASTEXITCODE -ne 0) { throw "static upload failed" }

  Write-Host "[4/4] invalidating CloudFront"
  aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation failed" }
}
finally {
  Pop-Location
}

Write-Host "Frontend deployed: https://$Domain"
