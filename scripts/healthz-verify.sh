# Verify /healthz from both paths: loopback (detail) and via CloudFront (minimal).
set -euo pipefail
echo "--- loopback (deploy-path) detail:"
curl -s -m 10 http://127.0.0.1:4000/healthz
echo
echo "--- loopback via nginx on port 80 (marker path, would never be public):"
curl -s -m 10 -o /dev/null -w "%{http_code}\n" http://127.0.0.1/healthz || true
