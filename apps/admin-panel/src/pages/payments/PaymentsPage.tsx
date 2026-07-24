import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchDiamondAnalytics, issueRefund } from '@/api/payments';

export default function PaymentsPage() {
  const [form, setForm] = useState({ userId: '', paymentId: '', reason: '' });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const { data: diamonds, isLoading } = useQuery({
    queryKey: ['diamond-analytics'],
    queryFn: fetchDiamondAnalytics,
  });

  const refundMut = useMutation({
    mutationFn: () => issueRefund({ userId: form.userId.trim(), paymentId: form.paymentId.trim(), reason: form.reason.trim() || undefined }),
    onSuccess: () => {
      setForm({ userId: '', paymentId: '', reason: '' });
      showToast('Refund issued successfully', true);
    },
    onError: (err: Error) => showToast(err.message ?? 'Refund failed', false),
  });

  const diamondStats = [
    { label: 'Total Issued', value: diamonds?.totalIssued ?? '—' },
    { label: 'Total Spent', value: diamonds?.totalSpent ?? '—' },
    { label: 'Net Balance', value: diamonds?.netBalance ?? '—' },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments & Refunds</h1>
        <p className="text-gray-500 text-sm mt-1">Diamond ledger overview and manual refund issuance</p>
      </div>

      {/* Diamond stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Diamond Ledger Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          {diamondStats.map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              {isLoading
                ? <div className="h-8 bg-gray-200 rounded animate-pulse mb-2" />
                : <p className="text-3xl font-bold text-amber-700">{s.value.toLocaleString()}</p>
              }
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top spend reasons */}
      {diamonds?.topSpendReasons && diamonds.topSpendReasons.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Spend Reasons</h2>
          <div className="space-y-2">
            {diamonds.topSpendReasons.map(r => {
              const max = diamonds.topSpendReasons[0].total;
              const pct = Math.round((r.total / max) * 100);
              return (
                <div key={r.reason} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-48 truncate font-mono">{r.reason.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#d97706' }} />
                  </div>
                  <span className="text-xs text-gray-700 w-16 text-right">{r.total.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Refund form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-1">Issue Refund</h2>
        <p className="text-xs text-gray-500 mb-4">Refunds reverse the payment record and restore diamonds. SUPERADMIN only.</p>
        <div className="space-y-3 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User ID <span className="text-red-500">*</span></label>
            <input value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} placeholder="UUID" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment ID <span className="text-red-500">*</span></label>
            <input value={form.paymentId} onChange={e => setForm(f => ({ ...f, paymentId: e.target.value }))} placeholder="UUID" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Customer request, fraud, etc." className="input w-full" />
          </div>
          <button
            onClick={() => refundMut.mutate()}
            disabled={!form.userId.trim() || !form.paymentId.trim() || refundMut.isPending}
            className="btn-primary disabled:opacity-50"
          >
            {refundMut.isPending ? 'Processing…' : 'Issue Refund'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 text-white text-sm px-4 py-3 rounded-lg shadow-lg z-50 ${toast.ok ? 'bg-green-700' : 'bg-red-700'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
