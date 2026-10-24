import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API_BASE = process.env.VITE_API_BASE_URL || "";
const SITE_URL = process.env.SITE_URL || "https://yourdomain.com";

async function fetchPosts() {
  if (!API_BASE) {
    console.warn("VITE_API_BASE_URL not set, using empty list");
    return [];
  }
  const res = await fetch(`${API_BASE}/api/v1/posts?status=published&limit=1000`);
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

function escapeXml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function main() {
  const posts = await fetchPosts();
  const urls = [
    { loc: `${SITE_URL}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${SITE_URL}/privacy`, changefreq: "monthly", priority: "0.5" },
    { loc: `${SITE_URL}/terms`, changefreq: "monthly", priority: "0.5" },
  ];
  for (const p of posts) {
    const id = p.id || p.slug;
    if (!id) continue;
    urls.push({
      loc: `${SITE_URL}/story/${id}`,
      changefreq: "weekly",
      priority: "0.8",
      lastmod: p.publishedAt || p.createdAt || new Date().toISOString(),
    });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
  const outPath = resolve(process.cwd(), "public", "sitemap.xml");
  writeFileSync(outPath, xml, "utf8");
  console.log(`Sitemap written to ${outPath} with ${urls.length} URLs`);
}

main().catch(err => { console.error(err); process.exit(1); });