import { useState, useEffect, FormEvent } from 'react';
import { apiClient } from '../../services/apiClient';
import { Invitation } from '../../types';
import Button from '../Button';

type InvitationStatus = 'pending' | 'used' | 'revoked' | 'expired';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'used', label: 'Used' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'expired', label: 'Expired' },
];

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500';

// Backend timestamps are naive UTC (no offset), so mark them as UTC before parsing
const parseUtc = (timestamp: string) =>
  new Date(/[zZ]|[+-]\d\d:\d\d$/.test(timestamp) ? timestamp : `${timestamp}Z`);

const getStatus = (inv: Invitation): InvitationStatus => {
  if (inv.used_at) return 'used';
  if (inv.revoked) return 'revoked';
  if (inv.expires_at && parseUtc(inv.expires_at) <= new Date()) return 'expired';
  return 'pending';
};

const getStatusColor = (status: InvitationStatus) => {
  switch (status) {
    case 'pending':
      return 'text-blue-700 bg-blue-100';
    case 'used':
      return 'text-green-700 bg-green-100';
    case 'revoked':
      return 'text-red-700 bg-red-100';
    case 'expired':
      return 'text-gray-700 bg-gray-100';
  }
};

const formatTimestamp = (timestamp: string | null) => {
  if (!timestamp) return '—';
  return parseUtc(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface InvitationsViewProps {
  isAdmin: boolean;
}

export default function InvitationsView({ isAdmin }: InvitationsViewProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // New invitation form
  const [email, setEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);

  useEffect(() => {
    if (isAdmin) loadInvitations();
  }, [statusFilter, isAdmin]);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.listInvitations(statusFilter || undefined);
      setInvitations(response.invitations);
    } catch (err: any) {
      setError(err.message || 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setError(null);
      setNotice(null);
      const days = expiresInDays.trim() ? parseInt(expiresInDays, 10) : null;
      const invitation = await apiClient.createInvitation(email.trim(), days, notes.trim());
      setCreatedInvitation(invitation);
      setEmail('');
      setNotes('');
      await loadInvitations();
    } catch (err: any) {
      setError(err.message || 'Failed to create invitation');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (inv: Invitation) => {
    if (!window.confirm(`Revoke the invitation for ${inv.email}?`)) return;
    try {
      setBusyId(inv.id);
      setError(null);
      await apiClient.revokeInvitation(inv.id);
      setNotice(`Revoked invitation for ${inv.email}.`);
      await loadInvitations();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke invitation');
    } finally {
      setBusyId(null);
    }
  };

  const handleResend = async (inv: Invitation) => {
    try {
      setBusyId(inv.id);
      setError(null);
      const refreshed = await apiClient.resendInvitation(inv.id);
      setCreatedInvitation(refreshed);
      setNotice(null);
      await loadInvitations();
    } catch (err: any) {
      setError(err.message || 'Failed to resend invitation');
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (inv: Invitation) => {
    if (!inv.invitation_url) return;
    try {
      await navigator.clipboard.writeText(inv.invitation_url);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(current => (current === inv.id ? null : current)), 2000);
    } catch {
      window.prompt('Copy the invitation link:', inv.invitation_url);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Admin access required to manage invitations.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Invitations</h1>
        <p className="text-gray-600">
          Registration is invite-only. Create, resend and revoke invitation links.
        </p>
      </div>

      {/* New Invitation */}
      <form
        onSubmit={handleCreate}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-3">New Invitation</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="newuser@example.edu"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expires in days
            </label>
            <input
              type="number"
              min={1}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="Never"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Button type="submit" variant="primary" size="sm" disabled={creating}>
            {creating ? 'Creating...' : 'Create Invitation'}
          </Button>
          <span className="text-xs text-gray-500">Leave "Expires in days" blank for no expiration.</span>
        </div>
      </form>

      {/* Link for a newly created or resent invitation */}
      {createdInvitation?.invitation_url && (
        <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg mb-6">
          <div className="text-sm text-emerald-800 mb-2">
            Invitation link for <strong>{createdInvitation.email}</strong>
            {createdInvitation.expires_at && <> (expires {formatTimestamp(createdInvitation.expires_at)})</>}:
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={createdInvitation.invitation_url}
              onFocus={(e) => e.target.select()}
              className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-emerald-200 rounded-lg"
            />
            <Button variant="secondary" size="sm" onClick={() => copyLink(createdInvitation)}>
              {copiedId === createdInvitation.id ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCreatedInvitation(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6">
          {notice}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-3">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              statusFilter === opt.value
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-sm text-gray-600 ml-2">
          {loading ? 'Loading...' : `${invitations.length} invitation${invitations.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Email', 'Status', 'Created', 'Expires', 'Used', 'Notes', 'Actions'].map(heading => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {!loading && invitations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No invitations found.
                  </td>
                </tr>
              ) : (
                invitations.map(inv => {
                  const status = getStatus(inv);
                  const busy = busyId === inv.id;
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{inv.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatTimestamp(inv.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {inv.expires_at ? formatTimestamp(inv.expires_at) : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatTimestamp(inv.used_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{inv.notes || ''}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3 text-sm font-medium whitespace-nowrap">
                          {status === 'pending' && inv.invitation_url && (
                            <button onClick={() => copyLink(inv)} className="text-emerald-600 hover:text-emerald-700">
                              {copiedId === inv.id ? 'Copied' : 'Copy link'}
                            </button>
                          )}
                          {status !== 'used' && (
                            <button
                              onClick={() => handleResend(inv)}
                              disabled={busy}
                              className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                            >
                              Resend
                            </button>
                          )}
                          {(status === 'pending' || status === 'expired') && (
                            <button
                              onClick={() => handleRevoke(inv)}
                              disabled={busy}
                              className="text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
