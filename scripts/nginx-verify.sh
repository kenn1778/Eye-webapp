set -euo pipefail
sleep 2
curl -s -D - -o /dev/null http://127.0.0.1/health 2>/dev/null | head -3 || \
curl -s -D - -o /dev/null -H "X-Origin-Verify: dummy" http://127.0.0.1/ | head -3
nginx -T 2>/dev/null | grep -n "server_tokens" | head -5
