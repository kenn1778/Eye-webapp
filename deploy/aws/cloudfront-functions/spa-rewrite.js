// CloudFront Function (viewer-request) — SPA fallback for the static site.
//
// Rewrites extension-less paths to /index.html so React Router owns all
// "pretty" URLs, while real files (assets/*, sitemap.xml, robots.txt, ...)
// pass through untouched. Lives on the DEFAULT cache behavior only; the
// /api/* and /healthz behaviors have no function, so backend 404s stay
// real 404s instead of being masked as 200 HTML.
//
// Replaces the distribution's old CustomErrorResponses mapping
// (403/404 -> /index.html 200), which also swallowed API errors.
//
// Deploy: aws cloudfront create-function --name spa-rewrite
//   --function-config file://spa-rewrite-config.json
//   --function-code fileb://spa-rewrite.js
// then publish-function and associate it on the default behavior.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var last = uri.split('/').pop();
  if (last === '' || last.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}
