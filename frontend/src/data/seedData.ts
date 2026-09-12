import type { Story, Community, AdminPost, AdminMetrics } from "../types";

export const emptyMetrics: AdminMetrics = {
  totalPosts: 0,
  publishedPosts: 0,
  scheduledPosts: 0,
  totalViews: 0,
};

// Starter content so the UI isn't empty before the API is wired up
// NOTE: Seed stories are illustrative examples only. Scholarship availability,
// deadlines and eligibility change frequently — always verify on the official source.
// Do not rely solely on summaries here for application decisions.
export const seedStories: Story[] = [
  {
    title: "The quiet power of applying before you feel ready",
    excerpt: "A practical guide to finding strong opportunities, building confidence, and submitting work that sounds like you.",
    category: "Scholarship tips",
    meta: "6 min read  /  12 Sep 2026",
    image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=85",
  },
  {
    title: "Five fully funded programs with autumn deadlines",
    excerpt: "A focused shortlist for ambitious students looking beyond the usual search results.",
    category: "Scholarships",
    meta: "4 min read  /  11 Sep 2026",
    image: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=900&q=85",
  },
  {
    title: "What a good first job application actually needs",
    excerpt: "Remove the noise from your CV, your email, and the three lines most recruiters read first.",
    category: "Work",
    meta: "5 min read  /  09 Sep 2026",
    image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85",
  },
  {
    title: "A new audio series for the long road ahead",
    excerpt: "Conversations with young people building meaningful careers in public, creative, and technical work.",
    category: "Culture",
    meta: "Listen  /  08 Sep 2026",
    image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=900&q=85",
  },
];

export const seedAdminPosts: AdminPost[] = [
  { title: "Five fully funded programs with autumn deadlines", type: "Scholarship", status: "Published", updated: "12 Sep, 09:42", author: "Amara Osei" },
  { title: "The quiet power of applying before you feel ready", type: "Scholarship tip", status: "Published", updated: "11 Sep, 16:18", author: "David Kim" },
  { title: "Remote internships accepting applications now", type: "Opportunity", status: "Scheduled", updated: "10 Sep, 14:05", author: "Amara Osei" },
  { title: "How to build a portfolio with no experience", type: "Guide", status: "Draft", updated: "09 Sep, 11:32", author: "Nia Harper" },
];

export const communities: Community[] = [
  { name: "Scholarship seekers", description: "Share deadlines, application notes, and funding leads.", members: "Community", accent: "community-green" },
  { name: "Creative careers", description: "A space for people building work across music, film, and design.", members: "Community", accent: "community-sage" },
  { name: "First job circle", description: "Practical support for your first role, internship, or freelance brief.", members: "Community", accent: "community-mint" },
];

export const categories = [
  "All stories",
  "Scholarships",
  "Scholarship tips",
  "News",
  "Opportunities",
  "Guides",
  "Work",
  "Culture",
  "Music",
  "Video",
  "Entertainment",
];

export const adminTabs = ["All posts", "Published", "Draft", "Scheduled"];
