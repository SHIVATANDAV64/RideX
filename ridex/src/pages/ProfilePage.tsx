import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, Bell, Shield, CreditCard,
  HelpCircle, LogOut, Star, Bike, UserCog, Phone, Ticket
} from 'lucide-react';
import { Models, Query } from 'appwrite';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { DB_ID, TABLE, tablesDB } from '../lib/appwrite';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  sub?: string;
  danger?: boolean;
  action: () => void;
}

export default function ProfilePage() {
  const { user, profile, isAdmin, logout, updateProfile } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.name ?? user?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [stats, setStats] = useState([
    { label: 'Rides', value: '0' },
    { label: 'Methods', value: '0' },
    { label: 'Contacts', value: '0' },
  ]);

  useEffect(() => {
    setDisplayName(profile?.name ?? user?.name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile, user]);

  useEffect(() => {
    if (!user) return;

    const currentUser = user;

    async function loadStats() {
      try {
        const [rides, methods, contacts] = await Promise.all([
          tablesDB.listRows<Models.Row>({
            databaseId: DB_ID,
            tableId: TABLE.RIDES,
            queries: [Query.equal('rider_id', currentUser.$id), Query.limit(500)],
          }),
          tablesDB.listRows<Models.Row>({
            databaseId: DB_ID,
            tableId: TABLE.PAYMENT_METHODS,
            queries: [Query.equal('user_id', currentUser.$id), Query.equal('is_active', true), Query.limit(100)],
          }),
          tablesDB.listRows<Models.Row>({
            databaseId: DB_ID,
            tableId: TABLE.EMERGENCY_CONTACTS,
            queries: [Query.equal('user_id', currentUser.$id), Query.limit(100)],
          }),
        ]);

        setStats([
          { label: 'Rides', value: String(rides.total) },
          { label: 'Methods', value: String(methods.total) },
          { label: 'Contacts', value: String(contacts.total) },
        ]);
      } catch {
        // Ignore stat errors on profile load.
      }
    }

    void loadStats();
  }, [user]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      nav('/', { replace: true });
    } catch {
      toast('Could not sign out. Try again.', 'error');
      setLoggingOut(false);
    }
  }

  async function handleSaveProfile() {
    if (!displayName.trim()) {
      toast('Name is required', 'error');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({ name: displayName.trim(), phone: phone.trim() || null });
      toast('Profile updated', 'success');
    } catch {
      toast('Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  const menu: MenuItem[][] = [
    [
      { icon: Bell, label: 'Notifications', sub: profile?.notifications_enabled ? 'Alerts are enabled' : 'Alerts are muted', action: () => nav('/profile/safety') },
      { icon: Shield, label: 'Safety', sub: 'Emergency contacts, SOS', action: () => nav('/profile/safety') },
      { icon: CreditCard, label: 'Payment methods', sub: 'UPI, cards, wallets', action: () => nav('/profile/payment-methods') },
    ],
    [
      { icon: Bike, label: 'Drive with RideX', sub: 'Earn on your schedule', action: () => nav('/driver') },
      { icon: HelpCircle, label: 'Help & Support', sub: 'FAQs, raise a ticket', action: () => nav('/support') },
      ...(isAdmin ? [{ icon: Ticket, label: 'Admin Console', sub: 'Tickets and payment triage', action: () => nav('/admin') }] : []),
    ],
    [
      { icon: LogOut, label: 'Sign out', danger: true, action: handleLogout },
    ],
  ];

  const initial = (user?.name?.[0] ?? 'R').toUpperCase();

  return (
    <div className="min-h-dvh bg-surface text-white pb-12">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-white/8 px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} aria-label="Go back" title="Go back" className="p-1.5 rounded-xl hover:bg-white/8 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">Profile</h1>
        </div>
      </header>

      {/* Avatar + name */}
      <div className="px-4 pt-8 pb-6 flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mb-4"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand to-blue-400 flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-brand/30">
            {initial}
          </div>
          <div className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-success border-2 border-surface" />
        </motion.div>

        <h2 className="text-xl font-bold text-white">{profile?.name ?? user?.name ?? 'Rider'}</h2>
        <p className="text-sm text-slate-400 mt-0.5">{profile?.email ?? user?.email}</p>
        <p className="text-xs text-slate-500 mt-1 capitalize">{profile?.role ?? 'rider'} account</p>

        {/* Stats row */}
        <div className="flex gap-6 mt-6">
          {stats.map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-lg font-black text-white">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Promo badge */}
        <div className="mt-5 flex items-center gap-2 bg-warning/10 border border-warning/25 rounded-full px-4 py-2">
          <Star size={14} className="text-warning fill-warning" />
          <span className="text-xs font-semibold text-warning">Synced account profile</span>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="bg-surface-card border border-white/8 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <UserCog size={16} className="text-brand" />
            <p className="text-sm font-semibold">Account details</p>
          </div>
          <Input label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <Input label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} icon={<Phone size={15} />} placeholder="+91 98xxxxxxx" />
          <Button fullWidth loading={savingProfile} onClick={handleSaveProfile}>Save Profile</Button>
        </div>
      </div>

      {/* Menu sections */}
      <div className="px-4 flex flex-col gap-4">
        {menu.map((section, si) => (
          <div key={si} className="bg-surface-card border border-white/8 rounded-2xl overflow-hidden">
            {section.map(({ icon: Icon, label, sub, danger, action }, i) => (
              <button
                key={label}
                onClick={action}
                disabled={danger && loggingOut}
                className={[
                  'flex items-center gap-4 w-full px-4 py-4 text-left transition-colors',
                  'hover:bg-white/4 active:bg-white/6',
                  i < section.length - 1 ? 'border-b border-white/6' : '',
                  danger ? 'text-danger' : 'text-white',
                ].join(' ')}
              >
                <div className={[
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  danger ? 'bg-danger/15' : 'bg-white/8',
                ].join(' ')}>
                  <Icon size={17} className={danger ? 'text-danger' : 'text-slate-300'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${danger ? 'text-danger' : 'text-white'}`}>{label}</p>
                  {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
                </div>
                {!danger && <ChevronRight size={16} className="text-slate-600 shrink-0" />}
                {danger && loggingOut && (
                  <span className="flex gap-1">
                    <span className="dot-1 w-1.5 h-1.5 rounded-full bg-danger" />
                    <span className="dot-2 w-1.5 h-1.5 rounded-full bg-danger" />
                    <span className="dot-3 w-1.5 h-1.5 rounded-full bg-danger" />
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-slate-600 mt-8">
        RideX v2.0.0 · Bengaluru, India
      </p>
    </div>
  );
}
