import { useEffect, useState } from 'react';
import { ArrowLeft, Shield, Phone, BellRing, Plus, Trash2 } from 'lucide-react';
import { ID, Models, Query } from 'appwrite';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { DB_ID, TABLE, tablesDB } from '../lib/appwrite';

type EmergencyContactRow = Models.Row & {
  user_id: string;
  name: string;
  phone: string;
  relationship: string;
  notify_on_sos: boolean;
  is_primary: boolean;
};

function ToggleRow({ label, description, checked, onToggle }: { label: string; description: string; checked: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="w-full rounded-2xl border border-white/8 bg-white/5 p-4 flex items-center justify-between text-left">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
      <div className={[ 'w-12 h-7 rounded-full transition-colors p-1', checked ? 'bg-brand' : 'bg-white/10' ].join(' ')}>
        <div className={[ 'w-5 h-5 rounded-full bg-white transition-transform', checked ? 'translate-x-5' : '' ].join(' ')} />
      </div>
    </button>
  );
}

export default function SafetyPage() {
  const { user, profile, updateProfile } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [contacts, setContacts] = useState<EmergencyContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [notifyOnSos, setNotifyOnSos] = useState(true);
  const [isPrimary, setIsPrimary] = useState(false);

  async function loadContacts() {
    if (!user) return;
    setLoading(true);
    try {
      const result = await tablesDB.listRows<EmergencyContactRow>({
        databaseId: DB_ID,
        tableId: TABLE.EMERGENCY_CONTACTS,
        queries: [Query.equal('user_id', user.$id), Query.orderDesc('is_primary'), Query.orderDesc('$createdAt'), Query.limit(50)],
      });
      setContacts(result.rows);
    } catch {
      toast('Failed to load emergency contacts', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContacts();
  }, [user]);

  async function addContact() {
    if (!user || !name.trim() || !phone.trim() || !relationship.trim()) return;
    setSaving(true);
    try {
      if (isPrimary) {
        await Promise.all(contacts.filter(contact => contact.is_primary).map((contact) => tablesDB.updateRow({
          databaseId: DB_ID,
          tableId: TABLE.EMERGENCY_CONTACTS,
          rowId: contact.$id,
          data: { is_primary: false },
        })));
      }

      await tablesDB.createRow({
        databaseId: DB_ID,
        tableId: TABLE.EMERGENCY_CONTACTS,
        rowId: ID.unique(),
        data: {
          user_id: user.$id,
          name: name.trim(),
          phone: phone.trim(),
          relationship: relationship.trim(),
          notify_on_sos: notifyOnSos,
          is_primary: isPrimary,
        },
      });

      setName('');
      setPhone('');
      setRelationship('');
      setNotifyOnSos(true);
      setIsPrimary(false);
      await loadContacts();
      toast('Emergency contact saved', 'success');
    } catch {
      toast('Failed to save emergency contact', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function togglePreference(key: 'notifications_enabled' | 'safety_alerts_enabled' | 'marketing_opt_in', value: boolean) {
    try {
      await updateProfile({ [key]: value });
    } catch {
      toast('Failed to update preferences', 'error');
    }
  }

  async function makePrimary(contact: EmergencyContactRow) {
    try {
      await Promise.all(contacts.map(async (item) => {
        const nextPrimary = item.$id === contact.$id;
        if (item.is_primary !== nextPrimary) {
          await tablesDB.updateRow({
            databaseId: DB_ID,
            tableId: TABLE.EMERGENCY_CONTACTS,
            rowId: item.$id,
            data: { is_primary: nextPrimary },
          });
        }
      }));
      await loadContacts();
      toast('Primary contact updated', 'success');
    } catch {
      toast('Failed to update primary contact', 'error');
    }
  }

  async function deleteContact(contactId: string) {
    try {
      await tablesDB.deleteRow({ databaseId: DB_ID, tableId: TABLE.EMERGENCY_CONTACTS, rowId: contactId });
      await loadContacts();
      toast('Emergency contact removed', 'success');
    } catch {
      toast('Failed to remove emergency contact', 'error');
    }
  }

  return (
    <div className="min-h-dvh bg-surface text-white pb-10">
      <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-white/8 px-4 py-4 flex items-center gap-3">
        <button onClick={() => nav(-1)} aria-label="Go back" title="Go back" className="p-1.5 rounded-xl hover:bg-white/8 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Safety</h1>
      </header>

      <div className="px-4 py-5 space-y-5">
        <section className="rounded-3xl border border-white/8 bg-surface-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand/15 flex items-center justify-center">
              <Shield size={20} className="text-brand" />
            </div>
            <div>
              <p className="text-sm font-semibold">Safety preferences</p>
              <p className="text-xs text-slate-400 mt-1">These settings live on your synced user profile.</p>
            </div>
          </div>

          <ToggleRow label="Ride notifications" description="Updates for driver match, trip start, and completion." checked={Boolean(profile?.notifications_enabled)} onToggle={() => void togglePreference('notifications_enabled', !profile?.notifications_enabled)} />
          <ToggleRow label="Safety alerts" description="Keep emergency and SOS related alerts active." checked={Boolean(profile?.safety_alerts_enabled)} onToggle={() => void togglePreference('safety_alerts_enabled', !profile?.safety_alerts_enabled)} />
          <ToggleRow label="Offers and marketing" description="Receive promo and campaign updates from RideX." checked={Boolean(profile?.marketing_opt_in)} onToggle={() => void togglePreference('marketing_opt_in', !profile?.marketing_opt_in)} />
        </section>

        <section className="rounded-3xl border border-white/8 bg-surface-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Emergency contacts</p>
              <p className="text-xs text-slate-400 mt-1">SOS flows use these contacts.</p>
            </div>
            <span className="text-xs text-slate-400">{contacts.length} saved</span>
          </div>

          <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Asha Sharma" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98xxxxxxx" />
            <Input label="Relationship" value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Sibling" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setNotifyOnSos((value) => !value)} className={[ 'rounded-2xl border px-3 py-3 text-xs font-semibold', notifyOnSos ? 'border-brand bg-brand/10 text-white' : 'border-white/8 bg-white/5 text-slate-300' ].join(' ')}>
              <BellRing size={14} className="inline mr-2" /> Notify on SOS
            </button>
            <button type="button" onClick={() => setIsPrimary((value) => !value)} className={[ 'rounded-2xl border px-3 py-3 text-xs font-semibold', isPrimary ? 'border-warning bg-warning/10 text-warning' : 'border-white/8 bg-white/5 text-slate-300' ].join(' ')}>
              <Phone size={14} className="inline mr-2" /> Primary contact
            </button>
          </div>

          <Button fullWidth loading={saving} icon={<Plus size={16} />} onClick={addContact}>Add Contact</Button>

          {loading ? (
            <div className="text-sm text-slate-400">Loading contacts...</div>
          ) : contacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No emergency contacts added yet.</div>
          ) : (
            <div className="space-y-3 pt-1">
              {contacts.map((contact) => (
                <div key={contact.$id} className="rounded-2xl border border-white/8 bg-white/5 p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/8 flex items-center justify-center shrink-0">
                    <Phone size={18} className="text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{contact.name}</p>
                      {contact.is_primary && <span className="text-[11px] font-semibold rounded-full bg-warning/15 text-warning px-2 py-0.5">Primary</span>}
                      {contact.notify_on_sos && <span className="text-[11px] font-semibold rounded-full bg-brand/15 text-brand px-2 py-0.5">SOS</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{contact.relationship} • {contact.phone}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="ghost" onClick={() => makePrimary(contact)} disabled={contact.is_primary}>Primary</Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => deleteContact(contact.$id)}>Remove</Button>
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