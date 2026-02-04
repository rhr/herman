import { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';
import { AuditLog } from '../../types';
import Button from '../Button';

const TABLE_OPTIONS = [
  { value: '', label: 'All Tables' },
  { value: 'specimens', label: 'Specimens' },
  { value: 'users', label: 'Users' },
  { value: 'piles', label: 'Piles' },
  { value: 'images', label: 'Images' },
  { value: 'annotations', label: 'Annotations' },
  { value: 'sequences', label: 'Sequences' },
];

const OPERATION_OPTIONS = [
  { value: '', label: 'All Operations' },
  { value: 'INSERT', label: 'Create (INSERT)' },
  { value: 'UPDATE', label: 'Update (UPDATE)' },
  { value: 'DELETE', label: 'Delete (DELETE)' },
];

export default function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  // Filters
  const [tableName, setTableName] = useState('');
  const [operation, setOperation] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting (always by timestamp, but can toggle asc/desc)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Expanded rows to show details
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Available users for filtering (derived from logs)
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);

  useEffect(() => {
    loadAuditLogs();
  }, [page, tableName, operation, userEmail, startDate, endDate, sortOrder]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.getAuditLogs({
        table_name: tableName || undefined,
        operation: operation || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        page_size: pageSize,
      });

      // Sort logs on client side based on sortOrder
      let sortedLogs = [...response.logs];
      if (sortOrder === 'asc') {
        sortedLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      } else {
        sortedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }

      // Filter by user email on client side (backend doesn't support email filtering directly)
      if (userEmail) {
        sortedLogs = sortedLogs.filter(log =>
          log.user_email?.toLowerCase().includes(userEmail.toLowerCase())
        );
      }

      setLogs(sortedLogs);
      setTotal(response.total);
      setTotalPages(Math.ceil(response.total / pageSize));

      // Extract unique user emails for filter dropdown
      const users = [...new Set(response.logs.map(log => log.user_email).filter(Boolean))].sort() as string[];
      setAvailableUsers(users);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (logId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  const resetFilters = () => {
    setTableName('');
    setOperation('');
    setUserEmail('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'INSERT':
        return 'text-green-700 bg-green-100';
      case 'UPDATE':
        return 'text-blue-700 bg-blue-100';
      case 'DELETE':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const renderChangedFields = (log: AuditLog) => {
    if (log.operation === 'INSERT') {
      return (
        <div className="mt-2 p-3 bg-green-50 rounded border border-green-200">
          <h4 className="font-semibold text-sm mb-2">New Record:</h4>
          <pre className="text-xs overflow-auto max-h-64">
            {JSON.stringify(log.new_values, null, 2)}
          </pre>
        </div>
      );
    }

    if (log.operation === 'DELETE') {
      return (
        <div className="mt-2 p-3 bg-red-50 rounded border border-red-200">
          <h4 className="font-semibold text-sm mb-2">Deleted Record:</h4>
          <pre className="text-xs overflow-auto max-h-64">
            {JSON.stringify(log.old_values, null, 2)}
          </pre>
        </div>
      );
    }

    if (log.operation === 'UPDATE' && log.changed_fields && log.changed_fields.length > 0) {
      return (
        <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
          <h4 className="font-semibold text-sm mb-2">
            Changed Fields: {log.changed_fields.join(', ')}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h5 className="font-medium text-xs text-gray-600 mb-1">Before:</h5>
              <pre className="text-xs overflow-auto max-h-48 bg-white p-2 rounded">
                {JSON.stringify(
                  log.changed_fields.reduce((acc, field) => {
                    if (log.old_values) acc[field] = log.old_values[field];
                    return acc;
                  }, {} as Record<string, any>),
                  null,
                  2
                )}
              </pre>
            </div>
            <div>
              <h5 className="font-medium text-xs text-gray-600 mb-1">After:</h5>
              <pre className="text-xs overflow-auto max-h-48 bg-white p-2 rounded">
                {JSON.stringify(
                  log.changed_fields.reduce((acc, field) => {
                    if (log.new_values) acc[field] = log.new_values[field];
                    return acc;
                  }, {} as Record<string, any>),
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading audit logs...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Audit Logs</h1>
        <p className="text-gray-600">
          Track all database changes including creates, updates, and deletes.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Table Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Table
            </label>
            <select
              value={tableName}
              onChange={(e) => { setTableName(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {TABLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Operation Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Operation
            </label>
            <select
              value={operation}
              onChange={(e) => { setOperation(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {OPERATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User Email
            </label>
            <input
              type="text"
              value={userEmail}
              onChange={(e) => { setUserEmail(e.target.value); setPage(1); }}
              placeholder="Filter by email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex items-center gap-3 mt-4">
          <Button variant="secondary" size="sm" onClick={resetFilters}>
            Reset Filters
          </Button>
          <div className="text-sm text-gray-600">
            Showing {logs.length} of {total} total logs
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Table
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Record ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operation
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  <div className="flex items-center gap-1">
                    Timestamp
                    <span className="text-gray-400">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No audit logs found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <>
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {log.table_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.record_id}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getOperationColor(log.operation)}`}>
                          {log.operation}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{log.user_email || 'Unknown'}</div>
                        {log.ip_address && (
                          <div className="text-xs text-gray-400">{log.ip_address}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRow(log.id)}
                          className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                        >
                          {expandedRows.has(log.id) ? 'Hide' : 'Show'}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(log.id) && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-gray-50">
                          {renderChangedFields(log)}
                          {log.user_agent && (
                            <div className="mt-2 text-xs text-gray-500">
                              <strong>User Agent:</strong> {log.user_agent}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
