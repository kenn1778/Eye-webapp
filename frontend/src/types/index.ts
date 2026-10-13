// Shared domain types

export type Story = {
  title: string;
  excerpt: string;
  category: string;
  meta: string;
  image: string;
  // Only set when a story links out somewhere, e.g. the official application site.
  actionUrl?: string;
  actionLabel?: string;
};

export type Community = {
  name: string;
  description: string;
  members: string;
  accent: string;
};

// `status` is both the admin workflow state and the tab filter, so it has to
// stay in sync with the admin tabs in seedData.
export type AdminPost = {
  title: string;
  type: string;
  status: "Published" | "Draft" | "Scheduled";
  updated: string;
  author: string;
};

export type AdminMetrics = {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  totalViews: number;
};

export type TeamRole = "Moderator" | "Administrator";

export type TeamMember = {
  name: string;
  email: string;
  role: TeamRole;
  status: "Active" | "Invited";
};
