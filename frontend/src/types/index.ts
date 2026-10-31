// Shared domain types

export type Story = {
  id?: string;
  title: string;
  excerpt: string;
  content?: string;
  category: string;
  meta: string;
  image: string;
  // Only set when a story links out somewhere, e.g. the official application site.
  actionUrl?: string;
  actionLabel?: string;
  // Paid placement: shows a "Sponsored" disclosure label when true.
  sponsored?: boolean;
  status?: "draft" | "published" | "scheduled";
  mediaAssetId?: string;
  linkHeaderAssetId?: string;
  audioAssetId?: string;
  videoAssetId?: string;
  linkHeaderUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  // Read counter pinged by the story page; powers the popular/trending lists.
  views?: number;
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
  views: number;
  messages: number;
  unreadMessages: number;
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
  views: { total: number };
  messages: { total: number; last7Days: number; last30Days: number };
  topCommunities: { name: string; messages: number }[];
};

// One day in the activity flow chart.
export type ActivityPoint = {
  date: string;
  subscribers: number;
  chat: number;
  reviews: number;
  views: number;
};

// An inbound message from the public contact form, as shown in the admin inbox.
export type AdminContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  handled: boolean;
  createdAt: string;
};

// The public author card, editable from the admin workspace.
export type AdminAuthorProfile = {
  name: string;
  role: string;
  bio: string;
  email: string;
  avatarUrl: string | null;
  updatedAt?: string;
};

export type TeamRole = "Moderator" | "Administrator";

export type TeamMember = {
  name: string;
  email: string;
  role: TeamRole;
  status: "Active" | "Invited";
};
