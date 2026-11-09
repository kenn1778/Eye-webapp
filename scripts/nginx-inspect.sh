set -euo pipefail
ls -la /etc/nginx/sites-enabled/
grep -n "server_tokens\|server {" /etc/nginx/sites-available/eye /etc/nginx/sites-enabled/* 2>/dev/null || true
echo "--- conf head:"
head -20 /etc/nginx/nginx.conf | grep -v "^#" | grep -v "^$"
grep -n "server_tokens" /etc/nginx/nginx.conf || echo "(no global server_tokens)"