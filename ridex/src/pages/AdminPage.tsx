import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeIndianRupee, ClipboardList } from 'lucide-react';
import { ExecutionMethod, Models, Query } from 'appwrite';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { DB_ID, FN, TABLE, functions, tablesDB } from '../lib/appwrite';

type SupportTicketRow = Models.Row & {
  user_id: string;
  ride_id?: string | null;
  type: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  assigned_to?: string | null;
};

type PaymentRow = Models.Row & {
  ride_id: string;
  rider_id: string;
  amount: number;
  method: string;
  provider: string;
  status: 'pending' | 'paid' | 'refunded';
  receipt_url?: string | null;
};

export default function AdminPage() {
  const toast = useToast();
  const nav = useNavigate();
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [ticketResult, paymentResult] = await Promise.all([
        tablesDB.listRows<SupportTicketRow>({
          databaseId: DB_ID,
          tableId: TABLE.SUPPORT_TICKETS,
          queries: [Query.orderDesc('$createdAt'), Query.limit(25)],
        }),
        tablesDB.listRows<PaymentRow>({
          databaseId: DB_ID,
          tableId: TABLE.PAYMENTS,
          queries: [Query.orderDesc('$createdAt'), Query.limit(25)],
        }),
      ]);

      setTickets(ticketResult.rows);
      setPayments(paymentResult.rows);
    } catch {
      toast('Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function updateTicket(ticketId: string, status: SupportTicketRow['status']) {
    setBusyKey(`ticket:${ticketId}:${status}`);
    try {
      const execution = await functions.createExecution(
        FN.ADMIN_UPDATE_TICKET,
        JSON.stringify({ ticketId, status, assignedTo: 'admin-console' }),
        false,
        '/',
        ExecutionMethod.POST,
      );
      const response = JSON.parse(execution.responseBody || '{}') as { ok?: boolean; message?: string };
      if (!response.ok) throw new Error(response.message || 'Ticket update failed');
      await loadData();
      toast('Ticket updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update ticket', 'error');
    } finally {
      setBusyKey(null);
    }
  }

  async function updatePayment(paymentId: string, status: PaymentRow['status']) {
    setBusyKey(`payment:${paymentId}:${status}`);
    try {
      const execution = await functions.createExecution(
        FN.ADMIN_UPDATE_PAYMENT,
        JSON.stringify({ paymentId, status, receiptUrl: null }),
        false,
        '/',
        ExecutionMethod.POST,
      );
      const response = JSON.parse(execution.responseBody || '{}') as { ok?: boolean; message?: string };
      if (!response.ok) throw new Error(response.message || 'Payment update failed');
      await loadData();
      toast('Payment updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update payment', 'error');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="min-h-dvh bg-surface text-white pb-10">
      <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-white/8 px-4 py-4 flex items-center gap-3">
        <button onClick={() => nav(-1)} aria-label="Go back" title="Go back" className="p-1.5 rounded-xl hover:bg-white/8 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Admin Console</h1>
      </header>

      <div className="px-4 py-5 space-y-5">
        <section className="rounded-3xl border border-white/8 bg-surface-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand/15 flex items-center justify-center"><ClipboardList size={20} className="text-brand" /></div>
            <div>
              <p className="text-sm font-semibold">Support queue</p>
              <p className="text-xs text-slate-400 mt-1">Triage support and safety tickets from the shared backend queue.</p>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-slate-400">Loading tickets...</div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.$id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{ticket.subject}</p>
                    <span className="text-[11px] font-semibold rounded-full bg-white/10 text-slate-300 px-2 py-0.5 capitalize">{ticket.status.replace('_', ' ')}</span>
                    <span className="text-[11px] font-semibold rounded-full bg-warning/10 text-warning px-2 py-0.5 capitalize">{ticket.severity}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{ticket.type} • user {ticket.user_id.slice(0, 8)}</p>
                  <p className="text-sm text-slate-300 mt-3 leading-6">{ticket.message}</p>
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <Button size="sm" variant="secondary" loading={busyKey === `ticket:${ticket.$id}:in_progress`} onClick={() => updateTicket(ticket.$id, 'in_progress')}>Mark In Progress</Button>
                    <Button size="sm" variant="success" loading={busyKey === `ticket:${ticket.$id}:resolved`} onClick={() => updateTicket(ticket.$id, 'resolved')}>Resolve</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/8 bg-surface-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-warning/15 flex items-center justify-center"><BadgeIndianRupee size={20} className="text-warning" /></div>
            <div>
              <p className="text-sm font-semibold">Payments</p>
              <p className="text-xs text-slate-400 mt-1">Reconcile payment records and sync ride payment state.</p>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-slate-400">Loading payments...</div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.$id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">₹{payment.amount.toFixed(0)} • {payment.provider}</p>
                    <span className="text-[11px] font-semibold rounded-full bg-white/10 text-slate-300 px-2 py-0.5 capitalize">{payment.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">ride {payment.ride_id.slice(0, 8)} • {payment.method}</p>
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <Button size="sm" variant="success" loading={busyKey === `payment:${payment.$id}:paid`} onClick={() => updatePayment(payment.$id, 'paid')}>Mark Paid</Button>
                    <Button size="sm" variant="danger" loading={busyKey === `payment:${payment.$id}:refunded`} onClick={() => updatePayment(payment.$id, 'refunded')}>Refund</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}