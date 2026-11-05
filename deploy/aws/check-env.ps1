$details = aws lightsail get-instance-access-details --instance-name eye-api --region us-east-1 --output json | ConvertFrom-Json
$keyPath = Join-Path ([IO.Path]::GetTempPath()) ("eye-check-" + [guid]::NewGuid().ToString("N") + ".pem")
[IO.File]::WriteAllText($keyPath, $details.accessDetails.privateKey)
[IO.File]::WriteAllText("$keyPath-cert.pub", $details.accessDetails.certKey)
icacls $keyPath /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
ssh -i $keyPath -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@3.218.162.50 'sed -n "18,22p" /opt/eye/backend/.env | cat -A'
Remove-Item -LiteralPath $keyPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "$keyPath-cert.pub" -Force -ErrorAction SilentlyContinue
