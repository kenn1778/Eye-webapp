import { useEffect, useRef, useState } from "react";
import type { Community } from "../types";
import { chatSeed, type ChatMessage } from "../data/chatSeed";

type Props = {
  community: Community;
  onClose: () => void;
  onLeave: () => void;
};

export function CommunityChat({ community, onClose, onLeave }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => chatSeed[community.name] ?? []);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // auto-focus input when chat opens
  useEffect(() => {
    inputRef.current?.focus();
  }, [community.name]);

  // auto-scroll to bottom when messages change
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const mine: ChatMessage = {
      id: String(Date.now()),
      community: community.name,
      user: "You",
      avatar: "YO",
      text,
      time,
      isMe: true,
    };

    setMessages((prev) => [...prev, mine]);
    setDraft("");

    // Simulate reply for demo - like a human in the room
    setIsTyping(true);
    window.setTimeout(() => {
      setIsTyping(false);
      const replies: Record<string, string[]> = {
        "Scholarship seekers": [
          "Thanks for sharing — I’ll check the official doc and reply here.",
          "Good question — I had the same issue last cycle. The portal updates at midnight WAT.",
        ],
        "Creative careers": [
          "Love this thread. I can intro you to a mentor who cuts trailers.",
          "Noted — will trim and re-upload. Appreciate the eyes.",
        ],
        "First job circle": [
          "Solid advice. Anyone want to do a mock interview this week?",
          "I’ll DM you a CV teardown checklist — 5 mins and you’re clearer.",
        ],
      };
      const pool = replies[community.name] ?? ["Got it — will follow up!"];
      const replyText = pool[Math.floor(Math.random() * pool.length)];
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          community: community.name,
          user: community.name === "Scholarship seekers" ? "Nia H." : community.name === "Creative careers" ? "Kwame B." : "Amara O.",
          avatar: community.name === "Scholarship seekers" ? "NH" : community.name === "Creative careers" ? "KB" : "AO",
          text: replyText,
          time: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
        },
      ]);
    }, 1200 + Math.random() * 800);
  };

  return (
    <div className="chat-shell" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <div className="chat-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="chat-panel">
        <header className="chat-header">
          <div className="chat-header-left">
            <div className={`community-art ${community.accent} chat-header-art`} aria-hidden="true">
              <span>◌</span><span>◌</span><span>◌</span>
            </div>
            <div>
              <h2 id="chat-title" className="chat-title">{community.name}</h2>
              <div className="chat-subtitle">
                <span className="chat-live-dot" aria-hidden="true" /> {community.members} • 12 online • #general
              </div>
            </div>
          </div>
          <div className="chat-header-actions">
            <button className="button-secondary chat-leave" type="button" onClick={onLeave}>Leave</button>
            <button className="reader-close" type="button" onClick={onClose} aria-label="Close chat">×</button>
          </div>
        </header>

        <div className="chat-notice">
          <span aria-hidden="true">🔒</span> This is a community chatroom. Be respectful, share sources, no spam. Messages are illustrative in demo.
        </div>

        <div ref={listRef} className="chat-list" role="log" aria-live="polite" aria-relevant="additions">
          {messages.map((m) => (
            <div key={m.id} className={`chat-msg ${m.isMe ? "is-me" : ""}`}>
              <span className="chat-avatar" aria-hidden="true">{m.avatar}</span>
              <div className="chat-bubble-wrap">
                <div className="chat-meta">
                  <strong>{m.user}</strong> <span>{m.time}</span>
                </div>
                <div className="chat-bubble">{m.text}</div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="chat-msg">
              <span className="chat-avatar" aria-hidden="true">…</span>
              <div className="chat-bubble-wrap">
                <div className="chat-bubble is-typing"><span></span><span></span><span></span></div>
              </div>
            </div>
          )}
        </div>

        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <label htmlFor="chat-input" className="sr-only">Message {community.name}</label>
          <input
            ref={inputRef}
            id="chat-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message #general in ${community.name}…`}
            autoComplete="off"
            maxLength={500}
          />
          <button className="button button-dark chat-send" type="submit" disabled={!draft.trim()} aria-label="Send message">
            Send <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="chat-footer-hint">
          Press <kbd>Enter</kbd> to send • <kbd>Esc</kbd> to close • Messages stay in this browser for demo
        </div>
      </div>
    </div>
  );
}
