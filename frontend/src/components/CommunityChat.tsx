import { useEffect, useRef, useState } from "react";
import type { Community } from "../types";
import { chatSeed, type ChatMessage } from "../data/chatSeed";
import { postChatMessage, fetchAgentReply } from "../lib/adminApi";

type Props = {
  community: Community;
  onClose: () => void;
  onLeave: () => void;
};

const MIN_REPLY_DELAY_MS = 1200;
const MAX_REPLY_DELAY_MS = 2000;

// Fallback replies used only when the EYE Assistant is unreachable, so the demo
// chat still feels alive offline.
const cannedReplies: Record<string, string[]> = {
  "Scholarship seekers": [
    "Thanks for sharing - I'll check the official doc and reply here.",
    "Good question - I had the same issue last cycle. The portal updates at midnight WAT.",
  ],
  "Creative careers": [
    "Love this thread. I can intro you to a mentor who cuts trailers.",
    "Noted - will trim and re-upload. Appreciate the eyes.",
  ],
  "First job circle": [
    "Solid advice. Anyone want to do a mock interview this week?",
    "I'll DM you a CV teardown checklist - 5 mins and you're clearer.",
  ],
};

// The assistant speaks with a single consistent identity.
const AGENT = { user: "EYE Assistant", avatar: "EA" };

function formatClockTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function CommunityChat({ community, onClose, onLeave }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => chatSeed[community.name] ?? []);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Monotonic suffix keeps message ids unique even when two messages are
  // created within the same millisecond (Date.now() alone can collide).
  const messageCountRef = useRef(0);
  const nextMessageId = () => `m-${Date.now()}-${messageCountRef.current++}`;

  // Guards against setState after the panel closes mid-request. Reset on mount
  // so React StrictMode's dev double-invoke doesn't leave it stuck false.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Move focus into the composer when the chat opens or switches community.
  useEffect(() => {
    inputRef.current?.focus();
  }, [community.name]);

  // Always show the newest message.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;

    const mine: ChatMessage = {
      id: nextMessageId(),
      community: community.name,
      user: "You",
      avatar: "YO",
      text,
      time: formatClockTime(new Date()),
      isMe: true,
    };

    setMessages((prev) => [...prev, mine]);
    setDraft("");
    setIsTyping(true);

    // Best-effort persistence so the admin feed sees real community activity.
    // The demo chat never waits on this.
    void postChatMessage(community.name, text);

    // Ask the EYE Assistant for a professional reply. If it is unavailable we
    // fall back to a canned line so the room never goes silent.
    void (async () => {
      const startedAt = Date.now();
      const reply = await fetchAgentReply(community.name, text);

      // Hold the typing indicator briefly so replies don't snap in instantly.
      const minDelay = randomBetween(MIN_REPLY_DELAY_MS, MAX_REPLY_DELAY_MS);
      const elapsed = Date.now() - startedAt;
      if (elapsed < minDelay) {
        await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
      }

      if (!isMountedRef.current) return;

      const pool = cannedReplies[community.name] ?? ["Got it - I'll follow up shortly."];
      const replyText = reply ?? pool[Math.floor(Math.random() * pool.length)];

      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          community: community.name,
          user: AGENT.user,
          avatar: AGENT.avatar,
          text: replyText,
          time: formatClockTime(new Date()),
        },
      ]);
      setIsTyping(false);
    })();
  };

  return (
    <div className="chat-shell" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <div className="chat-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="chat-panel">
        <header className="chat-header">
          <div className="chat-header-left">
            <div className={`community-art ${community.accent} chat-header-art`} aria-hidden="true">
              <span>&#9675;</span><span>&#9675;</span><span>&#9675;</span>
            </div>
            <div>
              <h2 id="chat-title" className="chat-title">{community.name}</h2>
              <div className="chat-subtitle">
                <span className="chat-live-dot" aria-hidden="true" /> {community.members} &bull; #general
              </div>
            </div>
          </div>
          <div className="chat-header-actions">
            <button className="button-secondary chat-leave" type="button" onClick={onLeave}>Leave</button>
            <button className="reader-close" type="button" onClick={onClose} aria-label="Close chat">&times;</button>
          </div>
        </header>

        <div className="chat-notice">
          <span aria-hidden="true">&#128274;</span> Community chatroom. Be respectful, share sources, no spam. The EYE Assistant may reply to help.
        </div>

        <div ref={listRef} className="chat-list" role="log" aria-live="polite" aria-relevant="additions">
          {messages.map((message) => (
            <div key={message.id} className={`chat-msg ${message.isMe ? "is-me" : ""}`}>
              <span className="chat-avatar" aria-hidden="true">{message.avatar}</span>
              <div className="chat-bubble-wrap">
                <div className="chat-meta">
                  <strong>{message.user}</strong> <span>{message.time}</span>
                </div>
                <div className="chat-bubble">{message.text}</div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="chat-msg">
              <span className="chat-avatar" aria-hidden="true">&hellip;</span>
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
            placeholder={`Message #general in ${community.name}...`}
            autoComplete="off"
            maxLength={500}
          />
          <button className="button button-dark chat-send" type="submit" disabled={!draft.trim()} aria-label="Send message">
            Send <span aria-hidden="true">&rarr;</span>
          </button>
        </form>

        <div className="chat-footer-hint">
          Press <kbd>Enter</kbd> to send &bull; <kbd>Esc</kbd> to close &bull; Messages stay in this browser for demo
        </div>
      </div>
    </div>
  );
}