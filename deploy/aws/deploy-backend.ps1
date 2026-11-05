# Publish the backend to the Lightsail instance (systemd + nginx), no Docker.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File deploy\aws\deploy-backend.ps1
#   powershell ... -File deploy\aws\deploy-backend.ps1 -HostIp 1.2.3.4 -KeyPath C:\keys\eye.pem
#
# If -KeyPath is omitted, a short-lived SSH key + certificate is fetched with
# `aws lightsail get-instance-access-details`. The private key is a secret and is
# written only to the OS temp directory, then deleted when the script exits.

param(
  [string]$InstanceName = "eye-api",
  [string]$HostIp = "3.218.162.50",
  [string]$Region = "us-east-1",
  [string]$KeyPath = ""
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$backend = Join-Path $root "backend"
$tar = Join-Path ([IO.Path]::GetTempPath()) "eye-backend.tar.gz"
$tempKey = $null

function Remove-TempKey {
  if ($script:tempKey) {
    Remove-Item -LiteralPath $script:tempKey -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath "$script:tempKey-cert.pub" -Force -ErrorAction SilentlyContinue
    $script:tempKey = $null
  }
}

try {
  Push-Location $backend
  try {
    Write-Host "[1/5] checking migration encoding"
    npm run check:migrations
    if ($LASTEXITCODE -ne 0) { throw "migration encoding check failed" }
  }
  finally {
    Pop-Location
  }

  if (-not $KeyPath) {
    Write-Host "[2/5] fetching a short-lived SSH key from Lightsail"
    $details = aws lightsail get-instance-access-details `
      --instance-name $InstanceName --region $Region --protocol ssh --output json | ConvertFrom-Json
    if (-not $details.accessDetails) { throw "could not read Lightsail access details" }
    $tempKey = Join-Path ([IO.Path]::GetTempPath()) ("eye-deploy-" + [guid]::NewGuid().ToString("N") + ".pem")
    [IO.File]::WriteAllText($tempKey, $details.accessDetails.privateKey)
    [IO.File]::WriteAllText("$tempKey-cert.pub", $details.accessDetails.certKey)
    icacls $tempKey /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
    $KeyPath = $tempKey
    if (-not $HostIp -and $details.accessDetails.ipAddress) { $HostIp = $details.accessDetails.ipAddress }
  }

  Write-Host "[3/5] packaging backend"
  Remove-Item -LiteralPath $tar -Force -ErrorAction SilentlyContinue
  tar -czf $tar `
    --exclude=node_modules --exclude=.env --exclude=.env.admin-credentials `
    --exclude=src/generated --exclude=.git --exclude=dev.log `
    --exclude=Dockerfile --exclude=.dockerignore -C $backend .
  if ($LASTEXITCODE -ne 0) { throw "tar failed" }

  Write-Host "[4/5] uploading to $HostIp"
  scp -i $KeyPath -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $tar "ubuntu@${HostIp}:/home/ubuntu/eye-backend.tar.gz"
  if ($LASTEXITCODE -ne 0) { throw "scp failed" }

  Write-Host "[5/5] installing, migrating and restarting"
  $remote = @'
set -e
trap 'sudo systemctl start eye-api || true' EXIT
echo "  stopping eye-api"
sudo systemctl stop eye-api
echo "  extracting"
tar -xzf /home/ubuntu/eye-backend.tar.gz -C /opt/eye/backend
cd /opt/eye/backend
rm -f Dockerfile .dockerignore
echo "  npm ci"
npm ci --no-audit --no-fund
echo "  prisma generate"
npx prisma generate
echo "  prisma migrate deploy"
npx prisma migrate deploy
echo "  starting eye-api"
sudo systemctl start eye-api
sleep 4
systemctl is-active eye-api
curl -s -m 10 http://127.0.0.1:4000/healthz
echo
'@
  $remote = $remote -replace "`r", ""
  ssh -i $KeyPath -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "ubuntu@$HostIp" $remote
  if ($LASTEXITCODE -ne 0) { throw "remote deploy failed" }
}
finally {
  Remove-TempKey
}

Write-Host "Backend deployed to $HostIp"
