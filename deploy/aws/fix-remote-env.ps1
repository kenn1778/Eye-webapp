$details = aws lightsail get-instance-access-details --instance-name eye-api --region us-east-1 --output json | ConvertFrom-Json
$keyPath = Join-Path ([IO.Path]::GetTempPath()) ("eye-check-" + [guid]::NewGuid().ToString("N") + ".pem")
[IO.File]::WriteAllText($keyPath, $details.accessDetails.privateKey)
[IO.File]::WriteAllText("$keyPath-cert.pub", $details.accessDetails.certKey)
icacls $keyPath /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null

$remoteCmd = @'
python3 -c "
with open('/opt/eye/backend/.env', 'r', encoding='utf-8') as f:
    lines = f.readlines()
new_lines = []
for line in lines:
    clean = line.strip('\r\n')
    if clean.startswith('EMAIL_FROM=') and not clean.startswith('EMAIL_FROM=\"'):
        val = clean.split('=', 1)[1].strip('\"\'')
        new_lines.append(f'EMAIL_FROM=\"{val}\"\n')
    else:
        new_lines.append(clean + '\n')
with open('/tmp/.env.fixed', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
"
sudo cp /tmp/.env.fixed /opt/eye/backend/.env
grep EMAIL_FROM /opt/eye/backend/.env
'@
$remoteCmd = $remoteCmd -replace "`r", ""

ssh -i $keyPath -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@3.218.162.50 "$remoteCmd"

Remove-Item -LiteralPath $keyPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "$keyPath-cert.pub" -Force -ErrorAction SilentlyContinue
