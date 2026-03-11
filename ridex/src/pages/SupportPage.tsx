import { useEffect, useState } from 'react';
import { ArrowLeft, Headphones, MessageSquare, ShieldAlert } from 'lucide-react';
import { ExecutionMethod, Models, Query } from 'appwrite';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { DB_ID, FN, TABLE, functions, tablesDB } from '../lib/appwrite';

type SupportTicketRow = Models.Row & {
  user_id: string;
  ride_id?: string | null;
  type: 'general' | 'sos' | 'payment' | 'driver';
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  assigned_to?: string | null;
};

type RiderRideRow = Models.Row & {
  pickup_address: string;
  dropoff_address: string;
  status: string;
};

export default function SupportPage() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [rides, setRides] = useState<RiderRideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<SupportTicketRow['type']>('general');
  const [severity, setSeverity] = useState<SupportTicketRow['severity']>('medium');
  const [rideId, setRideId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const [ticketResult, rideResult] = await Promise.all([
        tablesDB.listRows<SupportTicketRow>({
          databaseId: DB_ID,
          tableId: TABLE.SUPPORT_TICKETS,
          queries: [Query.equal('user_id', user.$id), Query.orderDesc('$createdAt'), Query.limit(50)],
        }),
        tablesDB.listRows<RiderRideRow>({
          databaseId: DB_ID,
          tableId: TABLE.RIDES,
          queries: [Query.equal('rider_id', user.$id), Query.orderDesc('$createdAt'), Query.limit(10)],
        }),
      ]);

      setTickets(ticketResult.rows);
      setRides(rideResult.rows);
    } catch {
      toast('Failed to load support data', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [user]);

  async function submitTicket() {
    if (!user || !subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const execution = await functions.createExecution(
        FN.RAISE_SUPPORT_TICKET,
        JSON.stringify({
          userId: user.$id,
          rideId: rideId || null,
          type,
          severity,
          subject: subject.trim(),
          message: message.trim(),
        }),
        false,
        '/',
        ExecutionMethod.POST,
      );

      const response = JSON.parse(execution.responseBody || '{}') as { ok?: boolean; message?: string };
      if (!response.ok) {
        throw new Error(response.message || 'Ticket could not be raised');
      }

      setRideId('');
      setSubject('');
      setMessage('');
      setType('general');
      setSeverity('medium');
      await loadData();
      toast('Support ticket created', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-surface text-white pb-10">
      <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-white/8 px-4 py-4 flex items-center gap-3">
        <button onClick={() => nav(-1)} aria-label="Go back" title="Go back" className="p-1.5 rounded-xl hover:bg-white/8 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Help & Support</h1>
      </header>

      <div className="px-4 py-5 space-y-5">
        <section className="rounded-3xl border border-white/8 bg-surface-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand/15 flex items-center justify-center"><Headphones size={20} className="text-brand" /></div>
            <div>
              <p className="text-sm font-semibold">Raise a ticket</p>
              <p className="text-xs text-slate-400 mt-1">Create a general, payment, or driver-related issue from the app.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['general', 'payment', 'driver', 'sos'] as SupportTicketRow['type'][]).map((option) => (
              <button key={option} type="button" onClick={() => setType(option)} className={[ 'rounded-2xl border px-3 py-2 text-xs font-semibold capitalize', type === option ? 'border-brand bg-brand/10 text-white' : 'border-white/8 bg-white/5 text-slate-300' ].join(' ')}>
                {option}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['low', 'medium', 'high', 'critical'] as SupportTicketRow['severity'][]).map((option) => (
              <button key={option} type="button" onClick={() => setSeverity(option)} className={[ 'rounded-2xl border px-3 py-2 text-xs font-semibold capitalize', severity === option ? 'border-warning bg-warning/10 text-warning' : 'border-white/8 bg-white/5 text-slate-300' ].join(' ')}>
                {option}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Linked ride</label>
            <select aria-label="Linked ride" title="Linked ride" value={rideId} onChange={(event) => setRideId(event.target.value)} className="w-full h-12 bg-white/5 border border-white/10 rounded-xl text-white text-sm px-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40">
              <option value="">No ride selected</option>
              {rides.map((ride) => (
                <option key={ride.$id} value={ride.$id}>
                  {ride.pickup_address.slice(0, 20)} {'->'} {ride.dropoff_address.slice(0, 20)} ({ride.status})
                </option>
              ))}
            </select>
          </div>

          <Input label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Payment was charged twice" />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Message</label>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} placeholder="Describe the issue clearly so support can resolve it faster." className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm px-4 py-3 placeholder:text-slate-500 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40 resize-none" />
          </div>

          <Button fullWidth loading={submitting} icon={<MessageSquare size={16} />} onClick={submitTicket}>Submit Ticket</Button>
        </section>

        <section className="rounded-3xl border border-white/8 bg-surface-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Your tickets</p>
            <span className="text-xs text-slate-400">{tickets.length} total</span>
          </div>

          {loading ? (
            <div className="text-sm text-slate-400">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No support tickets yet.</div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.$id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{ticket.subject}</p>
                    <span className="text-[11px] font-semibold rounded-full bg-white/10 text-slate-300 px-2 py-0.5 capitalize">{ticket.status.replace('_', ' ')}</span>
                    <span className="text-[11px] font-semibold rounded-full bg-warning/10 text-warning px-2 py-0.5 capitalize">{ticket.severity}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 capitalize">{ticket.type} {ticket.ride_id ? `• ride ${ticket.ride_id.slice(0, 8)}` : ''}</p>
                  <p className="text-sm text-slate-300 mt-3 leading-6">{ticket.message}</p>
                  {ticket.type === 'sos' && <div className="mt-3 text-xs text-danger flex items-center gap-2"><ShieldAlert size={14} /> SOS ticket logged through safety flow</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}