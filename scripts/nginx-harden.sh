# Idempotently turn off nginx version disclosure on the eye-api instance.
set -euo pipefail
CONF=/etc/nginx/sites-available/eye
if grep -q "server_tokens off;" "$CONF"; then
  echo "server_tokens already off"
else
  # Insert right after the opening "server {" line.
  sudo sed -i '0,/^server {/s//server {\n\n    server_tokens off;/' "$CONF"
  echo "inserted server_tokens off"
fi
sudo nginx -t
sudo systemctl reload nginx
echo "--- verification:"
curl -s -D - -o /dev/null http://127.0.0.1/api/v1/public/posts?limit=1 -H "X-Origin-Verify: $(sudo grep -oP '(?<=\$http_x_origin_verify != ")[^"]+' $CONF 2>/dev/null || true)" | head -6 || true
