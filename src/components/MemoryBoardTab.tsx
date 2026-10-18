import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthorizedUser, MemoryNote } from '../types';
import {
  getStoredMemoryNotes,
  saveNewMemoryNote,
  deleteMemoryNote,
} from '../services/storageService';
import {
  MessageSquareHeart,
  Send,
  Trash2,
  Calendar,
  ShieldCheck,
} from 'lucide-react';

interface MemoryBoardTabProps {
  currentUser: AuthorizedUser;
}

export const MemoryBoardTab: React.FC<MemoryBoardTabProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<MemoryNote[]>([]);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages(getStoredMemoryNotes());
  }, []);

  const handlePostMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Message content cannot be empty.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const newMsg = saveNewMemoryNote(
        content.trim(),
        'memory',
        'rose',
        currentUser,
        false
      );
      setMessages((prev) => [newMsg, ...prev]);
      setContent('');
    } catch (err) {
      setError('Failed to post message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMessage = (id: string) => {
    const updated = deleteMemoryNote(id);
    setMessages(updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-500/15">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <MessageSquareHeart className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Message Board
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            A secure, unified space for workspace announcements, notes, and messages.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Logged in as <strong className="text-white">{currentUser.name}</strong> ({currentUser.role})</span>
        </div>
      </div>

      {/* Posting Form */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-rose-500/20 rounded-2xl p-5 shadow-xl shadow-rose-950/20">
        <form onSubmit={handlePostMessage} className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-rose-300">
              Post New Message
            </label>
            <span className="text-xs text-slate-500">
              {content.length} / 1000 characters
            </span>
          </div>
          
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
            }}
            maxLength={1000}
            rows={3}
            placeholder="Write a message, update, or note for the board..."
            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/25 transition-all resize-none shadow-inner"
          />

          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${currentUser ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>Visible to all authorized workspace members</span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-medium text-sm shadow-lg shadow-rose-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Post Message</span>
            </button>
          </div>
        </form>
      </div>

      {/* Messages List / Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Recent Messages ({messages.length})
          </h3>
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <MessageSquareHeart className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-white">No messages yet</h4>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Be the first to post a message or announcement to the Message Board above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((msg) => {
                const canDelete = currentUser && (currentUser.email === msg.author.email || currentUser.role === 'Owner');
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="bg-slate-900/70 backdrop-blur-md border border-slate-800 hover:border-rose-500/30 rounded-2xl p-5 shadow-lg shadow-black/20 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${msg.author.avatarColor || 'from-rose-500 to-indigo-600'} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                          {msg.author.avatarInitials || msg.author.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">
                              {msg.author.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700">
                              {msg.author.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(msg.createdAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          title="Delete message"
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="mt-4 text-slate-200 text-sm whitespace-pre-wrap leading-relaxed pl-13">
                      {msg.content}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
