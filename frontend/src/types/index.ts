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
  // Paid placement: shows a "Sponsored" disclosure label when true.
  sponsored?: boolean;
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
  posts: number;
  stories: number;
  subscribers: number;
  chatMessages: number;
  reviews: number;
  unreadNotifications: number;
};

// A single row in the admin notification feed, as returned by the API.
export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actor: string | null;
  read: boolean;
  createdAt: string;
};

export type AdminInsights = {
  subscribers: { total: number; last7Days: number; last30Days: number };
  chat: { total: number; last7Days: number; last30Days: number };
  reviews: { total: number; averageRating: number };
  posts: { total: number };
  topCommunities: { name: string; messages: number }[];
};

// One day in the activity flow chart.
export type ActivityPoint = {
  date: string;
  subscribers: number;
  chat: number;
  reviews: number;
};

export type TeamRole = "Moderator" | "Administrator";

export type TeamMember = {
  name: string;
  email: string;
  role: TeamRole;
  status: "Active" | "Invited";
};
