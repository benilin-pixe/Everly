import React, { useState, useEffect } from 'react';
import {
  Video,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Sparkles,
  Calendar,
  Lock,
  Globe,
  Radio,
  Clock,
  Heart,
  Film,
  MessageCircle,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  EverlyMeetRoom,
  listEverlyMeetRooms,
  createGoogleMeetSpace,
  removeEverlyMeetRoom,
  markRoomJoined,
  getCachedMeetToken,
  requestMeetAccessToken,
} from '../services/googleMeetService';
import { AuthorizedUser } from '../types';

interface GoogleMeetViewProps {
  currentUser: AuthorizedUser;
}

export const GoogleMeetView: React.FC<GoogleMeetViewProps> = ({ currentUser }) => {
  const [rooms, setRooms] = useState<EverlyMeetRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // New room form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<'date-night' | 'casual' | 'movie-night' | 'planning'>('date-night');
  const [newAccessType, setNewAccessType] = useState<'OPEN' | 'TRUSTED' | 'RESTRICTED'>('OPEN');

  // Deletion confirmation state (MANDATORY per Workspace guidelines)
  const [roomToDelete, setRoomToDelete] = useState<EverlyMeetRoom | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Connection state
  const [isConnected, setIsConnected] = useState<boolean>(Boolean(getCachedMeetToken()));
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchRooms = async () => {
    setIsLoading(true);
    const loaded = await listEverlyMeetRooms();
    setRooms(loaded);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRooms();
    setIsConnected(Boolean(getCachedMeetToken()));
  }, []);

  const handleConnectOAuth = async () => {
    setIsConnecting(true);
    setErrorNotice(null);
    try {
      await requestMeetAccessToken(currentUser.email);
      setIsConnected(true);
      setSuccessNotice('Connected to Google Meet successfully!');
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Could not complete Google Meet authorization.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleQuickInstantMeet = async () => {
    setIsCreating(true);
    setErrorNotice(null);
    try {
      const room = await createGoogleMeetSpace({
        title: `Instant Video Rendezvous — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        description: 'Instant live call launched between BeniLin & Shana Love.',
        category: 'date-night',
        accessType: 'OPEN',
        user: currentUser,
      });

      setRooms((prev) => [room, ...prev.filter((r) => r.id !== room.id)]);
      window.open(room.meetingUri, '_blank', 'noopener,noreferrer');
      setSuccessNotice(`Google Meet created: ${room.title}`);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to start instant Google Meet call.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateSpaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setErrorNotice('Please provide a meeting title.');
      return;
    }

    setIsCreating(true);
    setErrorNotice(null);

    try {
      const room = await createGoogleMeetSpace({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        category: newCategory,
        accessType: newAccessType,
        user: currentUser,
      });

      setRooms((prev) => [room, ...prev.filter((r) => r.id !== room.id)]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setSuccessNotice(`New Google Meet space created: ${room.title}`);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to create Google Meet space.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = (room: EverlyMeetRoom) => {
    navigator.clipboard.writeText(room.meetingUri);
    setCopiedId(room.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleJoinCall = async (room: EverlyMeetRoom) => {
    await markRoomJoined(room.id);
    window.open(room.meetingUri, '_blank', 'noopener,noreferrer');
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, lastJoinedAt: new Date().toISOString() } : r))
    );
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;
    setIsDeleting(true);
    const success = await removeEverlyMeetRoom(roomToDelete.id, currentUser.email);
    setIsDeleting(false);
    if (success) {
      setRooms((prev) => prev.filter((r) => r.id !== roomToDelete.id));
      setRoomToDelete(null);
      setSuccessNotice('Google Meet space removed.');
      setTimeout(() => setSuccessNotice(null), 4000);
    } else {
      setErrorNotice('Failed to delete Google Meet space.');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'date-night':
        return <Heart className="w-4 h-4 text-rose-400" />;
      case 'movie-night':
        return <Film className="w-4 h-4 text-purple-400" />;
      case 'planning':
        return <Calendar className="w-4 h-4 text-amber-400" />;
      default:
        return <MessageCircle className="w-4 h-4 text-sky-400" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'date-night':
        return 'Date Night';
      case 'movie-night':
        return 'Cinema Watch';
      case 'planning':
        return 'Travel & Plans';
      default:
        return 'Casual Catchup';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f1424] via-[#090d18] to-[#04060b] border border-rose-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-rose-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>Google Meet Integration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>Rendezvous & Video Calls</span>
              <Sparkles className="w-5 h-5 text-amber-300" />
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Connect face-to-face across any distance with instant, high-definition Google Meet video spaces, romantic date night calls, and synchronized cinema viewing.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleQuickInstantMeet}
              disabled={isCreating}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-sm shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Video className="w-4 h-4" />
              <span>{isCreating ? 'Launching Call...' : 'Instant Video Call'}</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Meeting Space</span>
            </button>

            <button
              onClick={handleConnectOAuth}
              disabled={isConnecting}
              title={isConnected ? 'Google Meet OAuth Active' : 'Authorize Google Meet'}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-2 text-xs font-semibold ${
                isConnected
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300 hover:bg-indigo-900/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">{isConnected ? 'Meet Authorized' : 'Connect Google'}</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {errorNotice && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}
        {successNotice && (
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}
      </div>

      {/* Main Content: Meeting Rooms Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Active & Scheduled Spaces</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono">
                {rooms.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Shared meeting rooms accessible to BeniLin & Shana Love
            </p>
          </div>

          <button
            onClick={fetchRooms}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh rooms"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-44 rounded-3xl bg-[#0c101a] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-3xl bg-[#0c101a]/60 border border-white/5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">No Google Meet rooms yet</h3>
              <p className="text-xs text-slate-400 mt-1">
                Start an instant call or schedule a romantic rendezvous above.
              </p>
            </div>
            <button
              onClick={handleQuickInstantMeet}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors cursor-pointer"
            >
              Start First Video Call
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rooms.map((room) => {
              const isCopied = copiedId === room.id;
              return (
                <div
                  key={room.id}
                  className="group relative rounded-3xl bg-[#0e1322]/85 backdrop-blur-md border border-white/10 hover:border-rose-500/40 p-5 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-rose-950/20 space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                          {getCategoryIcon(room.category)}
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-rose-300">
                            {getCategoryLabel(room.category)}
                          </span>
                          <h3 className="font-bold text-white text-base group-hover:text-rose-200 transition-colors line-clamp-1">
                            {room.title}
                          </h3>
                        </div>
                      </div>

                      <button
                        onClick={() => setRoomToDelete(room)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete space (requires confirmation)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {room.description && (
                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {room.description}
                      </p>
                    )}

                    {/* Room details & Link Box */}
                    <div className="p-2.5 rounded-2xl bg-[#080b12] border border-white/5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-xs text-slate-300 truncate">
                          {room.meetingUri.replace('https://', '')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyLink(room)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                        title="Copy meeting link"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Footer & Join Button */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{new Date(room.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      <span>•</span>
                      <span className="text-slate-300 font-medium">{room.createdByName}</span>
                    </div>

                    <button
                      onClick={() => handleJoinCall(room)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Join Call</span>
                      <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Helpful Quick Tips for Couple Video Dates */}
      <div className="rounded-3xl bg-[#0c101c]/70 border border-white/5 p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300">
        <div className="space-y-1">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span>Romantic Date Night</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Light a candle, open Everly's music box in the background, and jump into your private meeting space.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-purple-400" />
            <span>Cinema Watchparties</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Present your screen or stream high-bitrate videos from Everly Cinema while reacting in real-time.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Private & Encrypted</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Powered by official Google Meet APIs with encrypted enterprise WebRTC and access controls.
          </p>
        </div>
      </div>

      {/* Modal: Create Meeting Space */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#0e1322] border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Video className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Create Google Meet Space</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSpaceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Friday Wine & Candlelit Date"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#080b12] border border-white/10 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes, date theme, or reminder..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#080b12] border border-white/10 text-white text-sm focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Occasion / Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#080b12] border border-white/10 text-white text-xs focus:outline-none focus:border-rose-500"
                  >
                    <option value="date-night">Date Night</option>
                    <option value="movie-night">Cinema Watch</option>
                    <option value="planning">Travel & Plans</option>
                    <option value="casual">Casual Call</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Access Policy
                  </label>
                  <select
                    value={newAccessType}
                    onChange={(e: any) => setNewAccessType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#080b12] border border-white/10 text-white text-xs focus:outline-none focus:border-rose-500"
                  >
                    <option value="OPEN">Open (Instant Join)</option>
                    <option value="TRUSTED">Trusted (Co-Owners)</option>
                    <option value="RESTRICTED">Restricted (Knock)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-xs shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? 'Creating Space...' : 'Create Space'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANDATORY Confirmation Dialog for Destructive Operation (Per Workspace Skill) */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-[#0e1322] border border-rose-500/30 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete Meeting Space?</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Are you sure you want to delete <span className="text-white font-semibold">"{roomToDelete.title}"</span>? This will remove the room from Everly's shared video spaces for both owners.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#080b12] text-xs font-mono text-slate-400 truncate">
              {roomToDelete.meetingUri}
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setRoomToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/40 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
