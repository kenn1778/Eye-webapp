# Add the X-Internal-Request transit marker to every proxy block, idempotent.
set -euo pipefail
CONF=/etc/nginx/sites-available/eye
if sudo grep -q "X-Internal-Request" "$CONF"; then
  echo "marker already present"
else
  sudo cp "$CONF" "/etc/nginx/sites-available/eye.bak-internal"
  sudo awk '
    /proxy_set_header X-Forwarded-Proto \$scheme;/ {
      print
      print "        proxy_set_header X-Internal-Request \"1\";"
      # Only block sed for the first occurrence per location - handled by repeat matches below.
      next
    }
    { print }
  ' /etc/nginx/sites-available/eye.bak-internal | sudo tee "$CONF" > /dev/null
  echo "marker inserted"
fi
sudo nginx -t
sudo systemctl reload nginx
echo "--- sanity: proxied request (carries marker) hits the API"
