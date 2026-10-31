import type { ReactElement } from "react";
import type { Story } from "../../types";
import type { PublicReview } from "../../lib/adminApi";
import scholarshipCommunityArt from "../../../../pics-1/Scholarship seekers.jpg";
import creativeCommunityArt from "../../../../pics-1/Creative careers.jpg";
import firstJobCommunityArt from "../../../../pics-1/First job circle.jpg";

export const PAGE_SIZE = 8;
export const CAROUSEL_SIZE = 4;
export const CAROUSEL_INTERVAL = 6000;
export const TESTIMONIAL_INTERVAL = 7000;

export const communityArt: Record<string, { src: string; alt: string; width: number; height: number }> = {
  "Scholarship seekers": {
    src: scholarshipCommunityArt,
    alt: "Students walking together on campus, representing a supportive scholarship-seeker community",
    width: 612,
    height: 323,
  },
  "Creative careers": {
    src: creativeCommunityArt,
    alt: "A busy creative studio with people collaborating across shared work tables",
    width: 500,
    height: 333,
  },
  "First job circle": {
    src: firstJobCommunityArt,
    alt: "Three early-career colleagues discussing work together and sharing guidance",
    width: 500,
    height: 333,
  },
};

// Fallback testimonials so the "What Our Readers Say" carousel is never empty
// while the reviews API is unreachable.
export const fallbackTestimonials: PublicReview[] = [
  {
    id: "t1",
    name: "Loven A",
    rating: 5,
    comment:
      "This blog has become my daily source of inspiration. The content is always valuable and well-written!",
    createdAt: "2026-09-02T09:00:00.000Z",
  },
  {
    id: "t2",
    name: "Tonia Prisca",
    rating: 5,
    comment:
      "I found two fully funded programs through the weekly brief. The deadlines filter alone is worth it.",
    createdAt: "2026-09-18T09:00:00.000Z",
  },
  {
    id: "t3",
    name: "Solomon Alozie",
    rating: 4,
    comment:
      "Clear, honest guidance. The application checklists saved me hours of second-guessing.",
    createdAt: "2026-10-04T09:00:00.000Z",
  },
];

// Category tiles get a stable icon per known category name; unknown categories
// fall back to the bookmark glyph so nothing renders blank.
const categoryIcons: Record<string, string> = {
  Scholarships: "cap",
  "Scholarship tips": "pen",
  Work: "briefcase",
  Culture: "music",
  News: "news",
  Opportunities: "compass",
  Guides: "book",
  Music: "music",
  Video: "play",
  Entertainment: "star",
};

export function CategoryIcon({ name }: { name: string }) {
  const kind = categoryIcons[name] ?? "bookmark";
  const paths: Record<string, ReactElement> = {
    cap: <path d="M3 8.2 12 4l9 4.2-9 4.2L3 8.2Zm3.4 3.6v3.1c0 1.5 2.5 2.7 5.6 2.7s5.6-1.2 5.6-2.7v-3.1M20.4 8.6v5.2" />,
    pen: <path d="M14.5 4.5 19.5 9.5 8.5 20.5H3.5v-5L14.5 4.5ZM12.5 6.5l5 5" />,
    briefcase: <path d="M4 8.5h16v11H4v-11Zm4.5 0V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2.5M4 13h16" />,
    music: <path d="M9 18.5a2.5 2.5 0 1 1-2.5-2.5c1.4 0 2.5 1.1 2.5 2.5Zm0 0V5.8L20 4v11.2M20 15.2a2.4 2.4 0 1 1-2.4-2.4c1.3 0 2.4 1.1 2.4 2.4Z" />,
    news: <path d="M4.5 5.5h13v13a2 2 0 0 0 2 2h-13a2 2 0 0 1-2-2v-13Zm2 13h13M8 9h6M8 12.5h6M8 16h4" />,
    compass: <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm2.8-11.8-1.6 4.4-4.4 1.6 1.6-4.4 4.4-1.6Z" />,
    book: <path d="M5 4.5h6a2.5 2.5 0 0 1 2.5 2.5v12.5A2.5 2.5 0 0 0 11 17H5V4.5Zm14 0h-6A2.5 2.5 0 0 0 10.5 7v12.5A2.5 2.5 0 0 1 13 17h6V4.5Z" />,
    play: <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm-2-12.5 6 3.5-6 3.5v-7Z" />,
    star: <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />,
    bookmark: <path d="M6.5 4h11v16.5L12 16.8l-5.5 3.7V4Z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}

const socialIconPaths: Record<string, ReactElement> = {
  x: <path d="M12.6 1h2.2L9.9 6.9 15.7 15h-4.5l-3.5-4.6L3.6 15H1.4l5.3-6.3L1.1 1h4.6l3.2 4.2L12.6 1Zm-.8 12.7h1.2L4.9 2.2H3.6l8.2 11.5Z" />,
  facebook: <path d="M9.5 15H7v-3h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 3h-2.3v7h-3.2v-7Z" />,
  instagram: <path d="M1.5 1.5h13v13h-13v-13Z" fill="none" stroke="currentColor" strokeWidth="1.3" />,
  linkedin: <path d="M3.4 2a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8ZM2.2 6h2.4v8H2.2V6Zm4 0h2.3v1.1h.03c.32-.6 1.1-1.24 2.27-1.24 2.43 0 2.88 1.6 2.88 3.68V14h-2.4v-3.9c0-.93-.02-2.13-1.3-2.13-1.3 0-1.5 1.01-1.5 2.06V14H6.2V6Z" />,
  youtube: <path d="M14.8 4.2c1.9 0 3.2 1.3 3.2 3.1v1.6c0 1.9-1.3 3.1-3.2 3.1H5.2C3.3 12 2 10.8 2 8.9V7.3c0-1.8 1.3-3.1 3.2-3.1h9.6ZM7.5 6.5v4l3.5-2-3.5-2Z" transform="translate(0 1.5)" />,
  mail: <path d="M1.5 3h13v10h-13V3Zm1.5 1.5 5 3.7 5-3.7" fill="none" stroke="currentColor" strokeWidth="1.3" />,
};

export function SocialIcon({ kind }: { kind: keyof typeof socialIconPaths }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      {socialIconPaths[kind]}
    </svg>
  );
}

// "6 min read  /  12 Sep 2026" -> "12 Sep 2026"; "Published 10/27/2026" -> "10/27/2026".
export function storyDate(story: Story): string {
  const meta = story.meta ?? "";
  const parts = meta.split("/");
  const tail = parts.length > 1 ? parts[parts.length - 1].trim() : meta.trim();
  return tail.replace(/^Published\s+/i, "") || meta;
}

export function storyViews(story: Story): number {
  return typeof story.views === "number" ? story.views : 0;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
