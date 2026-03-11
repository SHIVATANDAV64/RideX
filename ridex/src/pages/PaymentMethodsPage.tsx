import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, Wallet, Star, Trash2 } from 'lucide-react';
import { ID, Models, Query } from 'appwrite';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { DB_ID, TABLE, tablesDB } from '../lib/appwrite';

type PaymentMethodRow = Models.Row & {
  user_id: string;
  type: 'cash' | 'stripe_test_card' | 'upi';
  label: string;
  brand?: string | null;
  last4?: string | null;
  expiry_month?: string | null;
  expiry_year?: string | null;
  provider_reference?: string | null;
  is_default: boolean;
  is_active: boolean;
};

export default function PaymentMethodsPage() {
  const { user, profile, updateProfile } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<PaymentMethodRow['type']>('cash');
  const [label, setLabel] = useState('');
  const [brand, setBrand] = useState('');
  const [last4, setLast4] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');

  async function loadMethods() {
    if (!user) return;
    setLoading(true);
    try {
      const result = await tablesDB.listRows<PaymentMethodRow>({
        databaseId: DB_ID,
        tableId: TABLE.PAYMENT_METHODS,
        queries: [Query.equal('user_id', user.$id), Query.orderDesc('is_default'), Query.orderDesc('$createdAt'), Query.limit(50)],
      });
      setMethods(result.rows);
    } catch {
      toast('Failed to load payment methods', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMethods();
  }, [user]);

  async function addMethod() {
    if (!user || !label.trim()) return;
    setSaving(true);
    try {
      const shouldBeDefault = methods.every(method => !method.is_default || !method.is_active);
      const created = await tablesDB.createRow<PaymentMethodRow>({
        databaseId: DB_ID,
        tableId: TABLE.PAYMENT_METHODS,
        rowId: ID.unique(),
        data: {
          user_id: user.$id,
          type,
          label: label.trim(),
          brand: brand.trim() || null,
          last4: last4.trim() || null,
          expiry_month: expiryMonth.trim() || null,
          expiry_year: expiryYear.trim() || null,
          provider_reference: null,
          is_default: shouldBeDefault,
          is_active: true,
        },
      });

      if (shouldBeDefault) {
        await updateProfile({ preferred_payment_method_id: created.$id });
      }

      setLabel('');
      setBrand('');
      setLast4('');
      setExpiryMonth('');
      setExpiryYear('');
      await loadMethods();
      toast('Payment method saved', 'success');
    } catch {
      toast('Failed to save payment method', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(method: PaymentMethodRow) {
    try {
      await Promise.all(methods.map(async (item) => {
        if (item.$id === method.$id && !item.is_default) {
          await tablesDB.updateRow({
            databaseId: DB_ID,
            tableId: TABLE.PAYMENT_METHODS,
            rowId: item.$id,
            data: { is_default: true, is_active: true },
          });
          return;
        }

        if (item.$id !== method.$id && item.is_default) {
          await tablesDB.updateRow({
            databaseId: DB_ID,
            tableId: TABLE.PAYMENT_METHODS,
            rowId: item.$id,
            data: { is_default: false },
          });
        }
      }));

      await updateProfile({ preferred_payment_method_id: method.$id });
      await loadMethods();
      toast('Default payment method updated', 'success');
    } catch {
      toast('Failed to update default payment method', 'error');
    }
  }

  async function deactivateMethod(method: PaymentMethodRow) {
    try {
      await tablesDB.updateRow({
        databaseId: DB_ID,
        tableId: TABLE.PAYMENT_METHODS,
        rowId: method.$id,
        data: { is_active: false, is_default: false },
      });

      if (profile?.preferred_payment_method_id === method.$id) {
        await updateProfile({ preferred_payment_method_id: null });
      }

      await loadMethods();
      toast('Payment method removed', 'success');
    } catch {
      toast('Failed to remove payment method', 'error');
    }
  }

  return (
    <div className="min-h-dvh bg-surface text-white pb-10">
      <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-white/8 px-4 py-4 flex items-center gap-3">
        <button onClick={() => nav(-1)} aria-label="Go back" title="Go back" className="p-1.5 rounded-xl hover:bg-white/8 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Payment Methods</h1>
      </header>

      <div className="px-4 py-5 space-y-5">
        <section className="rounded-3xl border border-white/8 bg-surface-card p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Add payment method</p>
            <p className="text-xs text-slate-400 mt-1">This controls the default rider payment preference used across the app.</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'stripe_test_card'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                className={[
                  'rounded-2xl border px-3 py-2 text-xs font-semibold capitalize transition-colors',
                  type === option ? 'border-brand bg-brand/15 text-white' : 'border-white/8 bg-white/5 text-slate-300',
                ].join(' ')}
              >
                {option.replace('_', ' ')}
              </button>
            ))}
          </div>

          <Input label="Label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Personal UPI / Test Visa / Cash" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Brand" value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Visa / GPay" />
            <Input label="Last 4" value={last4} maxLength={4} onChange={(event) => setLast4(event.target.value.replace(/\D/g, ''))} placeholder="4242" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Expiry month" value={expiryMonth} maxLength={2} onChange={(event) => setExpiryMonth(event.target.value.replace(/\D/g, ''))} placeholder="12" />
            <Input label="Expiry year" value={expiryYear} maxLength={4} onChange={(event) => setExpiryYear(event.target.value.replace(/\D/g, ''))} placeholder="2029" />
          </div>

          <Button onClick={addMethod} loading={saving} fullWidth>
            Save Payment Method
          </Button>
        </section>

        <section className="rounded-3xl border border-white/8 bg-surface-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Saved methods</p>
            <span className="text-xs text-slate-400">{methods.filter(method => method.is_active).length} active</span>
          </div>

          {loading ? (
            <div className="text-sm text-slate-400">Loading methods...</div>
          ) : methods.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No payment methods saved yet.</div>
          ) : (
            <div className="space-y-3">
              {methods.map((method) => (
                <div key={method.$id} className="rounded-2xl border border-white/8 bg-white/5 p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/8 flex items-center justify-center shrink-0">
                    {method.type === 'upi' ? <Wallet size={18} className="text-brand" /> : <CreditCard size={18} className="text-brand" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{method.label}</p>
                      {method.is_default && <span className="text-[11px] font-semibold rounded-full bg-warning/15 text-warning px-2 py-0.5 flex items-center gap-1"><Star size={10} /> Default</span>}
                      {!method.is_active && <span className="text-[11px] font-semibold rounded-full bg-white/10 text-slate-400 px-2 py-0.5">Inactive</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 capitalize">
                      {method.type.replace('_', ' ')}
                      {method.last4 ? ` • **** ${method.last4}` : ''}
                      {method.expiry_month && method.expiry_year ? ` • ${method.expiry_month}/${method.expiry_year}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => makeDefault(method)} disabled={!method.is_active || method.is_default}>Default</Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => deactivateMethod(method)} disabled={!method.is_active}>
                      Remove
                    </Button>
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