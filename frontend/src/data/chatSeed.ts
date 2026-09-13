export type ChatMessage = {
  id: string;
  community: string;
  user: string;
  avatar: string;
  text: string;
  time: string; // e.g., "09:42"
  isMe?: boolean;
};

export const chatSeed: Record<string, ChatMessage[]> = {
  "Scholarship seekers": [
    { id: "1", community: "Scholarship seekers", user: "Amina K.", avatar: "AK", text: "Has anyone heard back from the DAAD shortlist? My status still says under review.", time: "09:12" },
    { id: "2", community: "Scholarship seekers", user: "David O.", avatar: "DO", text: "Mine updated yesterday — check your spam, the invite was there. Deadline to confirm is Friday.", time: "09:18", isMe: false },
    { id: "3", community: "Scholarship seekers", user: "You", avatar: "YO", text: "Thanks! Found it. Anyone has a template for the motivation letter?", time: "09:22", isMe: true },
    { id: "4", community: "Scholarship seekers", user: "Nia H.", avatar: "NH", text: "I dropped one in the pinned files — covers structure + common mistakes. Feedback welcome.", time: "09:31" },
  ],
  "Creative careers": [
    { id: "1", community: "Creative careers", user: "Kwame B.", avatar: "KB", text: "Showcase tonight at Galleria — 7pm. Bring your portfolio, 3 studios are scouting.", time: "10:04" },
    { id: "2", community: "Creative careers", user: "Sofia L.", avatar: "SL", text: "Just posted my short — would love brutal feedback on the first 30s.", time: "10:22" },
    { id: "3", community: "Creative careers", user: "You", avatar: "YO", text: "Saw it — the cold open is strong. Maybe cut the second establishing shot?", time: "10:27", isMe: true },
  ],
  "First job circle": [
    { id: "1", community: "First job circle", user: "Priya M.", avatar: "PM", text: "Deloitte Ghana opened 12 analyst roles. I can refer 2 people — DM your CV.", time: "08:45" },
    { id: "2", community: "First job circle", user: "Joseph A.", avatar: "JA", text: "For entry-level, is it better to list university projects or freelance work first?", time: "09:02" },
    { id: "3", community: "First job circle", user: "You", avatar: "YO", text: "Projects first, with outcomes. Recruiters skim for impact in 7 seconds.", time: "09:08", isMe: true },
    { id: "4", community: "First job circle", user: "Amara O.", avatar: "AO", text: "Agreed — add metrics: e.g., ‘Cut load time 34%’ beats ‘Worked on website’.", time: "09:15" },
  ],
};
