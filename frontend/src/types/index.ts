// Shared domain types

export type Story = {
  title: string;
  excerpt: string;
  category: string;
  meta: string;
  image: string;
  // Optional call-to-action, set only when a story links out to an external
  // page such as the official application site.
  actionUrl?: string;
  actionLabel?: string;
};

export type Community = {
  name: string;
  description: string;
  members: string;
  accent: string;
};

// `status` doubles as the admin workflow state and the tab filter, so this
// union must stay in sync with the admin tabs in seedData.
export type AdminPost = {
  title: string;
  type: string;
  status: "Published" | "Draft" | "Scheduled";
  updated: string;
  author: string;
};

// Counts backing the admin dashboard summary tiles.
export type AdminMetrics = {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  totalViews: number;
};

// Role controls what a team member can do inside the admin workspace.
export type TeamRole = "Moderator" | "Administrator";

export type TeamMember = {
  name: string;
  email: string;
  role: TeamRole;
  status: "Active" | "Invited";
};
