# One-shot SSH against the Lightsail instance using the deploy script's exact
# key + certificate pattern (Lightsail keys expire fast; cert must sit beside
# the private key for OpenSSH to use it). The remote script is base64'd so the
# PowerShell pipeline can't mangle line endings or eat characters.
param([string]$ScriptName = "remote-cleanup.sh")
$ErrorActionPreference = "Stop"

$details = aws lightsail get-instance-access-details `
  --instance-name eye-api --region us-east-1 --protocol ssh --output json | ConvertFrom-Json
if (-not $details.accessDetails) { throw "could not read Lightsail access details" }

$tempKey = Join-Path ([IO.Path]::GetTempPath()) ("eye-ops-" + [guid]::NewGuid().ToString("N") + ".pem")
[IO.File]::WriteAllText($tempKey, $details.accessDetails.privateKey)
[IO.File]::WriteAllText("$tempKey-cert.pub", $details.accessDetails.certKey)
icacls $tempKey /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
$hostIp = $details.accessDetails.ipAddress

try {
  $raw = [IO.File]::ReadAllText("$PSScriptRoot\$ScriptName") -replace "\r\n", "\n"
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($raw))
  ssh -i $tempKey -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "ubuntu@$hostIp" "echo $b64 | base64 -d | bash -s"
  if ($LASTEXITCODE -ne 0) { throw "remote script failed" }
}
finally {
  Remove-Item -LiteralPath $tempKey -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath "$tempKey-cert.pub" -Force -ErrorAction SilentlyContinue
}
