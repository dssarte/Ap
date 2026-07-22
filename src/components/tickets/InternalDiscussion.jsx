import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Lock, AtSign, Loader2 } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { safeDate } from "@/lib/dateUtils";

// Parse @mentions in text and highlight them
function MessageContent({ content }) {
  const parts = content.split(/(@\S+)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="bg-amber-100 text-amber-800 font-semibold rounded px-1 py-0.5 text-xs">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// @mention dropdown popup
function MentionDropdown({ query, users, onSelect, position }) {
  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(query.toLowerCase()) ||
    u.email?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);

  if (!filtered.length) return null;

  return (
    <div
      className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-64 overflow-hidden"
      style={{ bottom: position.bottom, left: position.left }}
    >
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
          <AtSign className="w-3 h-3" /> Mention a team member
        </span>
      </div>
      {filtered.map(u => (
        <button
          key={u.id}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
          onMouseDown={e => { e.preventDefault(); onSelect(u); }}
        >
          <Avatar className="w-6 h-6">
            <AvatarFallback className="bg-[#1fd655] text-slate-900 text-xs font-bold">
              {(u.full_name || u.email || 'U')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{u.full_name || u.email}</p>
            <p className="text-xs text-slate-400 truncate">{u.email}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function CommentBubble({ comment, currentUserEmail }) {
  const isOwn = comment.author_email === currentUserEmail;
  const initials = (comment.author_name || comment.author_email || 'U')[0].toUpperCase();
  const commentDate = safeDate(comment.created_date);
  let time = '';
  if (commentDate) {
    try {
      time = formatInTimeZone(commentDate, 'Asia/Manila', "MMM d, h:mm a");
    } catch {
      time = 'Date unavailable';
    }
  }

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="w-7 h-7 flex-shrink-0 mt-1">
        <AvatarFallback className={`text-xs font-bold ${isOwn ? 'bg-[#1fd655] text-slate-900' : 'bg-slate-200 text-slate-700'}`}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {!isOwn && (
            <span className="text-xs font-semibold text-slate-700">{comment.author_name || comment.author_email}</span>
          )}
          <span className="text-xs text-slate-400">{time}</span>
        </div>
        <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isOwn
            ? 'bg-[#1fd655] text-slate-900 rounded-tr-sm'
            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
        }`}>
          <MessageContent content={comment.content} />
        </div>
      </div>
    </div>
  );
}

export default function InternalDiscussion({ ticket, user, staffUsers }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // string when active
  const [mentionPos, setMentionPos] = useState({ bottom: 0, left: 0 });
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  const loadComments = useCallback(async () => {
    const all = await base44.entities.TicketComment.filter({ ticket_id: ticket.id });
    const internal = all.filter(c => c.is_internal);
    setComments(internal.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
  }, [ticket.id]);

  useEffect(() => {
    loadComments();
    // Real-time subscription
    const unsub = base44.entities.TicketComment.subscribe((event) => {
      if (event.type === 'create' && event.data?.ticket_id === ticket.id && event.data?.is_internal) {
        setComments(prev => {
          if (prev.find(c => c.id === event.id)) return prev;
          return [...prev, event.data].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        });
      }
    });
    return unsub;
  }, [ticket.id, loadComments]);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);

    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const mentionMatch = textBefore.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionStart(cursor - mentionMatch[0].length);
      // Position dropdown above textarea
      const rect = textareaRef.current.getBoundingClientRect();
      setMentionPos({ bottom: 8, left: 0 });
    } else {
      setMentionQuery(null);
    }
  };

  const handleMentionSelect = (selectedUser) => {
    const mention = `@${selectedUser.full_name || selectedUser.email}`;
    const before = text.slice(0, mentionStart);
    const after = text.slice(textareaRef.current.selectionStart);
    const newText = before + mention + ' ' + after;
    setText(newText);
    setMentionQuery(null);
    textareaRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setMentionQuery(null); return; }
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await base44.entities.TicketComment.create({
      ticket_id: ticket.id,
      content: text.trim(),
      author_email: user.email,
      author_name: user.full_name,
      is_internal: true,
    });
    setText('');
    setMentionQuery(null);
    setSending(false);
  };

  const mentionable = staffUsers || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex-shrink-0">
        <Lock className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-amber-700">Staff-only internal discussion — not visible to ticket submitters</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50 min-h-0">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-10 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Internal Discussion</p>
            <p className="text-xs text-slate-400 mt-1">Start a private thread. Use @ to mention team members.</p>
          </div>
        ) : (
          comments.map(c => (
            <CommentBubble key={c.id} comment={c} currentUserEmail={user.email} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white p-3 relative">
        {mentionQuery !== null && (
          <div className="absolute left-3 right-3" style={{ bottom: '100%', marginBottom: 4 }}>
            <MentionDropdown
              query={mentionQuery}
              users={mentionable}
              onSelect={handleMentionSelect}
              position={mentionPos}
            />
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Write an internal note… Use @ to mention someone, Enter to send"
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            size="icon"
            className="bg-amber-500 hover:bg-amber-600 text-white shadow-md flex-shrink-0 h-9 w-9 rounded-xl"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 pl-1">
          <kbd className="bg-slate-100 rounded px-1">Enter</kbd> send · <kbd className="bg-slate-100 rounded px-1">Shift+Enter</kbd> new line · <kbd className="bg-slate-100 rounded px-1">@</kbd> mention
        </p>
      </div>
    </div>
  );
}
