import { useCallback, useEffect, useState } from 'react';
import { Building2, Cloud, Database, Download, Mail, RefreshCw, Rocket, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, NumInput, SelectInput, Tabs, TextInput } from '../components/ui/Fields';
import { EmptyState, PageHeader } from '../components/ui/Misc';
import { useData } from '../data/DataContext';
import { generateSeed } from '../data/seed';
import { writeSeed } from '../data/seedRunner';
import { useTeam, type Member } from '../data/team';
import { useActions, useRun } from '../data/useActions';
import { CURRENCIES, ROLE_LABELS, type CurrencyCode, type Invite, type Role } from '../data/types';
import { firebaseEnabled } from '../lib/firebase';
import { fmtDate, fmtNum } from '../lib/format';
import { can } from '../lib/permissions';
import { useToast } from '../components/ui/Toast';

const INVITE_ROLES: Role[] = ['manager', 'rep', 'storekeeper', 'accountant'];

function CompanyTab() {
  const { company } = useData();
  const actions = useActions();
  const { run, busy } = useRun();
  const [name, setName] = useState(company.name);
  const [phone, setPhone] = useState(company.phone ?? '');
  const [currency, setCurrency] = useState<CurrencyCode>(company.currency);
  const [dial, setDial] = useState(company.dialCode);
  const [days, setDays] = useState(company.defaultCreditDays);
  const dirty = name !== company.name || phone !== (company.phone ?? '') || currency !== company.currency || dial !== company.dialCode || days !== company.defaultCreditDays;
  return (
    <div className="card pad" style={{ maxWidth: 720 }}>
      <div className="form-grid">
        <Field label="اسم الشركة" className="full">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="هاتف الشركة">{(id) => <TextInput id={id} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" style={{ textAlign: 'start' }} />}</Field>
        <Field label="العملة">
          {(id) => (
            <SelectInput id={id} value={currency} onChange={(e) => { const c = e.target.value as CurrencyCode; setCurrency(c); setDial(CURRENCIES[c].dial); }}>
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => <option key={c} value={c}>{CURRENCIES[c].label} ({CURRENCIES[c].symbol})</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label="مفتاح الدولة (واتساب)" hint="بدون + — مثال: 966">{(id) => <TextInput id={id} value={dial} onChange={(e) => setDial(e.target.value.replace(/\D/g, ''))} dir="ltr" style={{ textAlign: 'start' }} />}</Field>
        <Field label="مدة الائتمان الافتراضية للعملاء الجدد">{(id) => <NumInput id={id} value={days} onChange={(v) => setDays(Math.round(v))} decimals={0} suffix="يوم" />}</Field>
      </div>
      <div className="row" style={{ marginTop: '1.2rem', justifyContent: 'flex-end' }}>
        <Button variant="primary" disabled={!dirty || !name.trim()} loading={busy} onClick={() => run(() => actions.updateCompany({ name: name.trim(), phone, currency, dialCode: dial, defaultCreditDays: days }), 'تم حفظ إعدادات الشركة ✓')}>حفظ التغييرات</Button>
      </div>
    </div>
  );
}

function TeamTab() {
  const { profile, mode } = useAuth();
  const { reps } = useData();
  const team = useTeam();
  const toast = useToast();
  const { run, busy } = useRun();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('rep');
  const [repId, setRepId] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [m, i] = await Promise.all([team.listMembers(), team.listInvites()]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذّر تحميل الفريق');
    } finally {
      setLoading(false);
    }
  }, [team, toast]);
  useEffect(() => void refresh(), [refresh]);

  const isOwner = profile!.role === 'owner';
  const valid = name.trim() && /^\S+@\S+\.\S+$/.test(email) && (role !== 'rep' || repId);

  return (
    <div className="col" style={{ gap: '1.2rem', maxWidth: 900 }}>
      {mode === 'demo' && <div className="callout info"><Rocket size={18} /> في الوضع التجريبي الفريق محلي. على Firebase تُحفظ الدعوات في قاعدة البيانات ويُفعَّل الموظف ببريده.</div>}
      <div className="card pad">
        <h3 style={{ marginBottom: '0.9rem' }}><UserPlus size={18} style={{ display: 'inline', verticalAlign: '-3px' }} /> دعوة موظف</h3>
        <div className="form-grid">
          <Field label="الاسم">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="البريد الإلكتروني">{(id) => <TextInput id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" style={{ textAlign: 'start' }} />}</Field>
          <Field label="الدور">{(id) => <SelectInput id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>{INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</SelectInput>}</Field>
          {role === 'rep' && <Field label="ربط بسجل المندوب">{(id) => <SelectInput id={id} value={repId} onChange={(e) => setRepId(e.target.value)}><option value="">اختر…</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</SelectInput>}</Field>}
        </div>
        <div className="row" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
          <Button variant="primary" leading={<Mail size={16} />} disabled={!valid} loading={busy} onClick={async () => { const ok = await run(async () => { await team.invite({ name: name.trim(), email: email.trim().toLowerCase(), role, ...(role === 'rep' ? { repId } : {}) }); return true; }, 'تم إنشاء الدعوة — اطلب منه التسجيل ببريده ✓'); if (ok) { setName(''); setEmail(''); void refresh(); } }}>إرسال الدعوة</Button>
        </div>
      </div>

      {invites.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>دعوات معلّقة</h3></div>
          <div className="table-wrap" style={{ marginTop: '0.6rem' }}>
            <table className="table"><tbody>
              {invites.map((i) => (
                <tr key={i.email}>
                  <td><b>{i.name}</b><div className="muted xs ltr">{i.email}</div></td>
                  <td><Badge tone="violet">{ROLE_LABELS[i.role]}</Badge></td>
                  <td className="muted small">{fmtDate(i.createdAt)}</td>
                  <td><Button size="sm" variant="ghost" onClick={async () => { await team.revoke(i.email); void refresh(); }}>إلغاء</Button></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3><Users size={18} /> أعضاء الفريق ({fmtNum(members.length)})</h3></div>
        {loading ? <p className="muted pad" style={{ padding: '1.5rem' }}>جارٍ التحميل…</p> : (
          <div className="table-wrap" style={{ marginTop: '0.6rem' }}>
            <table className="table"><tbody>
              {members.map((m) => (
                <tr key={m.uid}>
                  <td><span className="row" style={{ gap: 10 }}><Avatar name={m.name} round size="sm" /><span><b>{m.name}</b><div className="muted xs ltr">{m.email}</div></span></span></td>
                  <td>
                    {m.role === 'owner' || !isOwner || m.uid === profile!.uid ? <Badge tone={m.role === 'owner' ? 'green' : 'violet'}>{ROLE_LABELS[m.role]}</Badge> : (
                      <SelectInput value={m.role} onChange={async (e) => { await team.setRole(m.uid, e.target.value as Role, m.repId); void refresh(); }} aria-label="الدور" style={{ minHeight: 36, width: 150 }}>
                        {(['manager', 'rep', 'storekeeper', 'accountant'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </SelectInput>
                    )}
                  </td>
                  <td>{isOwner && m.role !== 'owner' && m.uid !== profile!.uid && <Button size="sm" variant="ghost" icon aria-label="إزالة" onClick={async () => { if (window.confirm(`إزالة ${m.name} من الفريق؟`)) { await team.remove(m.uid); void refresh(); } }}><Trash2 size={15} /></Button>}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        )}
      </div>
    </div>
  );
}

function DataTab() {
  const data = useData();
  const { mode, resetDemoData } = useAuth();
  const { run, busy } = useRun();
  const empty = data.customers.length === 0 && data.products.length === 0;

  const exportJson = () => {
    const { customers, products, warehouses, stock, orders, collections, reps, zones, offers, visits, movements, company } = data;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), company, customers, products, warehouses, stock, orders, collections, reps, zones, offers, visits, movements }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bcodx-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="col" style={{ gap: '1.2rem', maxWidth: 760 }}>
      <div className="card pad">
        <div className="row" style={{ gap: 12 }}>
          <span className="set-ico"><Cloud size={22} /></span>
          <div className="grow">
            <b>قاعدة البيانات</b>
            <div className="muted small">{mode === 'firebase' ? 'Cloud Firestore — متصل ومتزامن، مع تخزين محلي للعمل دون إنترنت.' : 'وضع العرض التجريبي — بيانات محلية داخل هذا المتصفح فقط.'}</div>
          </div>
          <Badge tone={firebaseEnabled ? 'green' : 'violet'} dot>{firebaseEnabled ? 'Firebase' : 'تجريبي'}</Badge>
        </div>
      </div>
      <div className="card pad">
        <div className="row" style={{ gap: 12 }}>
          <span className="set-ico"><Download size={22} /></span>
          <div className="grow"><b>نسخة احتياطية</b><div className="muted small">نزّل كل بيانات شركتك كملف JSON.</div></div>
          <Button onClick={exportJson}>تنزيل JSON</Button>
        </div>
      </div>
      {mode === 'firebase' ? (
        <div className="card pad">
          <div className="row" style={{ gap: 12 }}>
            <span className="set-ico"><Database size={22} /></span>
            <div className="grow"><b>بيانات تجريبية</b><div className="muted small">{empty ? 'شركتك فارغة. حمّل بيانات واقعية لاستكشاف النظام.' : 'متاح فقط عندما تكون الشركة فارغة حتى لا تختلط بياناتك الحقيقية.'}</div></div>
            <Button variant="primary" disabled={!empty} loading={busy} onClick={() => run(() => writeSeed(data.store, generateSeed().data), 'تم تحميل البيانات التجريبية ✓')}>تحميل</Button>
          </div>
        </div>
      ) : (
        <div className="card pad">
          <div className="row" style={{ gap: 12 }}>
            <span className="set-ico"><RefreshCw size={22} /></span>
            <div className="grow"><b>إعادة ضبط البيانات التجريبية</b><div className="muted small">يمسح تغييراتك ويعيد البيانات الأصلية.</div></div>
            <Button variant="danger" onClick={() => { if (window.confirm('إعادة ضبط كل البيانات التجريبية؟')) resetDemoData(); }}>إعادة ضبط</Button>
          </div>
        </div>
      )}
      <div className="card pad">
        <div className="row" style={{ gap: 12 }}>
          <span className="set-ico"><ShieldCheck size={22} /></span>
          <div className="grow"><b>الأمان والصلاحيات</b><div className="muted small">كل شركة معزولة بقواعد Firestore، والصلاحيات تُفرض على مستوى الخادم حسب الدور.</div></div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'company' | 'team' | 'data'>('company');
  const canTeam = can(profile!.role, 'team.manage');
  return (
    <>
      <PageHeader title="الإعدادات" subtitle="بيانات الشركة، الفريق والصلاحيات، والبيانات" />
      <Tabs name="settings-tab" value={tab} onChange={setTab} options={[{ value: 'company', label: '🏢 الشركة' }, ...(canTeam ? [{ value: 'team' as const, label: '👥 الفريق' }] : []), { value: 'data', label: '🗄️ البيانات' }]} />
      <div style={{ height: '1.2rem' }} />
      {tab === 'company' && (can(profile!.role, 'team.manage') ? <CompanyTab /> : <EmptyState icon={<Building2 />} title="للمدراء فقط" />)}
      {tab === 'team' && canTeam && <TeamTab />}
      {tab === 'data' && <DataTab />}
    </>
  );
}
