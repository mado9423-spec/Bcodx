import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Building2, Check, CheckCircle2, ClipboardList, Eye, EyeOff, Lock, Mail, MailCheck, MessageCircle, Rocket, ShieldCheck, Sparkles, User, Wallet, WifiOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Fields';
import { LogoTile, Wordmark } from '../components/Logo';
import { Segmented } from '../components/ui/Fields';
import { ROLE_LABELS, type Role } from '../data/types';
import { authErrorMessage, DEMO_PROFILES, useAuth } from './AuthContext';

const FEATURES = [
  { icon: ClipboardList, text: 'طلبات المندوبين تصل فورًا وتخصم المخزون تلقائيًا' },
  { icon: ShieldCheck, text: 'ائتمان ذكي: يمنع تجاوز الحد ويطلب موافقة المدير' },
  { icon: MessageCircle, text: 'كشف حساب وتذكير سداد بضغطة واحدة عبر واتساب' },
  { icon: WifiOff, text: 'يعمل دون إنترنت في الميدان ويزامن عند عودة الاتصال' },
];

function HeroArt() {
  return (
    <div className="auth-art" aria-hidden>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <svg className="route" viewBox="0 0 520 300" fill="none">
        <motion.path
          d="M20 250 C 110 250, 120 150, 200 150 S 300 235, 360 190 S 450 70, 500 60"
          stroke="rgba(255,255,255,.55)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="2 12"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -140 }}
          transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
        />
        {[
          [20, 250],
          [200, 150],
          [360, 190],
          [500, 60],
        ].map(([x, y], i) => (
          <g key={i}>
            <motion.circle cx={x} cy={y} r="9" fill="#fff" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.2, type: 'spring' }} />
            <motion.circle cx={x} cy={y} r="9" fill="none" stroke="#fff" strokeWidth="2" animate={{ r: [9, 26], opacity: [0.8, 0] }} transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.5 }} />
          </g>
        ))}
        <motion.g
          initial={{ x: 0, y: 0 }}
          animate={{ x: [0, 180, 340, 480], y: [0, -100, -60, -190] }}
          transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut', repeatType: 'reverse' }}
        >
          {/* a "shipment" travelling between hubs: the Bhub mark in miniature */}
          <g transform="translate(6,240) scale(0.2)">
            <polygon points="-60.5,-77 -6.8,-46 -6.8,16 -60.5,47 -114.2,16 -114.2,-46" fill="#0FB5AE" />
            <polygon points="60.5,-77 114.2,-46 114.2,16 60.5,47 6.8,16 6.8,-46" fill="#FF6B5B" />
            <polygon points="0,28 53.7,59 53.7,121 0,152 -53.7,121 -53.7,59" fill="#FFC93C" />
            <circle r="15" fill="#1D2B3A" />
            <circle r="5.5" fill="#F7F1E5" />
          </g>
        </motion.g>
      </svg>
      <motion.div className="float-card fc1" animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
        <span className="fc-ico" style={{ background: '#e6f9f1', color: '#067a4c' }}><Check size={18} /></span>
        <div>
          <b>طلب جديد #2410-3FA</b>
          <span>سوبرماركت النور • 4,820 ر.س</span>
        </div>
      </motion.div>
      <motion.div className="float-card fc2" animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut', delay: 0.6 }}>
        <span className="fc-ico" style={{ background: '#ece8ff', color: '#4a2bd1' }}><Wallet size={18} /></span>
        <div>
          <b>تحصيل 3,500 ر.س</b>
          <span>المندوب أحمد • قبل دقيقتين</span>
        </div>
      </motion.div>
      <motion.div className="float-card fc3" animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 5.5, ease: 'easeInOut', delay: 1.2 }}>
        <span className="fc-ico" style={{ background: '#fff6dd', color: '#8a5a00' }}><AlertTriangle size={18} /></span>
        <div>
          <b>مخزون منخفض</b>
          <span>مياه معدنية 330مل — بقي 12 كرتون</span>
        </div>
      </motion.div>
    </div>
  );
}

function Hero() {
  return (
    <section className="auth-hero">
      <HeroArt />
      <div className="auth-hero-text">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="auth-top">
            <div className="auth-brand">
              <LogoTile size={52} animate />
              <Wordmark height={28} />
            </div>
            <span className="auth-pill">
              <Sparkles size={14} /> منظومة إدارة الموزعين
            </span>
          </div>
          <h1>
            من واتساب وإكسل ودفتر…
            <br />
            <em>إلى منظومة واحدة حيّة</em>
          </h1>
          <p>العملاء ← الطلبات ← المنتجات ← المخزون ← التحصيل ← التقارير. كل شيء مترابط ومباشر، من المندوب في الميدان حتى مكتب الإدارة.</p>
        </motion.div>
        <motion.ul initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.4 } } }}>
          {FEATURES.map((f) => (
            <motion.li key={f.text} variants={{ hidden: { opacity: 0, x: 24 }, show: { opacity: 1, x: 0 } }}>
              <span className="feat-ico"><f.icon size={18} /></span>
              {f.text}
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function PasswordInput({ value, onChange, id, autoComplete }: { value: string; onChange: (v: string) => void; id: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-affix">
      <Lock size={18} />
      <TextInput id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required minLength={6} dir="ltr" style={{ textAlign: 'start' }} />
      <button type="button" className="btn ghost icon sm" onClick={() => setShow((s) => !s)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} style={{ position: 'absolute', insetInlineEnd: 6, top: 5 }}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function DemoStart() {
  const { startDemo } = useAuth();
  const roles = Object.keys(DEMO_PROFILES) as Role[];
  return (
    <div className="col" style={{ gap: '1rem' }}>
      <div className="callout info">
        <Rocket size={18} />
        <span>أنت في <b>وضع العرض التجريبي</b>: بيانات واقعية جاهزة تعمل داخل متصفحك دون الحاجة إلى حساب أو اتصال.</span>
      </div>
      <Button variant="primary" size="lg" block leading={<Rocket size={18} />} onClick={() => startDemo('owner')}>
        ابدأ التجربة الآن
      </Button>
      <div className="divider-text">أو ادخل بصلاحية محددة</div>
      <div className="role-grid">
        {roles.map((r) => (
          <button key={r} className="role-chip" onClick={() => startDemo(r)}>
            <b>{ROLE_LABELS[r]}</b>
            <span>{DEMO_PROFILES[r].name}</span>
          </button>
        ))}
      </div>
      <p className="muted xs center">
        لتفعيل قاعدة بيانات Firebase الحقيقية أضف مفاتيح المشروع في ملف <span className="ltr">.env.local</span> (راجع README).
      </p>
    </div>
  );
}

type Tab = 'login' | 'register' | 'join';

function FirebaseForms() {
  const { signIn, signUpOwner, signUpStaff, resetPassword } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [demoData, setDemoData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (tab === 'login') await signIn(email, password);
      else if (tab === 'register') await signUpOwner({ name, email, password, companyName: company, withDemoData: demoData });
      else await signUpStaff({ name, email, password });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) return setError('اكتب بريدك الإلكتروني أولًا ثم اضغط «نسيت كلمة المرور».');
    try {
      await resetPassword(email);
      setError('');
      setInfo('أرسلنا رابط استعادة كلمة المرور إلى بريدك.');
    } catch (err) {
      setError(authErrorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="col" style={{ gap: '1rem' }}>
      <Segmented
        name="auth-tab"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setError('');
          setInfo('');
        }}
        options={[
          { value: 'login', label: 'دخول' },
          { value: 'register', label: 'شركة جديدة' },
          { value: 'join', label: 'انضمام لفريق' },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} className="col" style={{ gap: '1rem' }} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
          {tab !== 'login' && (
            <Field label="الاسم الكامل">
              {(id) => (
                <div className="input-affix">
                  <User size={18} />
                  <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                </div>
              )}
            </Field>
          )}
          {tab === 'register' && (
            <Field label="اسم الشركة">
              {(id) => (
                <div className="input-affix">
                  <Building2 size={18} />
                  <TextInput id={id} value={company} onChange={(e) => setCompany(e.target.value)} required autoComplete="organization" />
                </div>
              )}
            </Field>
          )}
          <Field label="البريد الإلكتروني" hint={tab === 'join' ? 'استخدم نفس البريد الذي دعاك به مدير الشركة' : undefined}>
            {(id) => (
              <div className="input-affix">
                <Mail size={18} />
                <TextInput id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" dir="ltr" style={{ textAlign: 'start' }} />
              </div>
            )}
          </Field>
          <Field label="كلمة المرور">{(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />}</Field>
          {tab === 'register' && (
            <label className="check">
              <input type="checkbox" checked={demoData} onChange={(e) => setDemoData(e.target.checked)} />
              <span>ابدأ ببيانات تجريبية جاهزة (يمكن حذفها لاحقًا)</span>
            </label>
          )}
        </motion.div>
      </AnimatePresence>
      {error && <div className="callout bad" role="alert">{error}</div>}
      {info && <div className="callout ok">{info}</div>}
      <Button type="submit" variant="primary" size="lg" block loading={busy} leading={tab === 'login' ? <ShieldCheck size={18} /> : <ArrowLeft size={18} />}>
        {tab === 'login' ? 'تسجيل الدخول' : tab === 'register' ? 'إنشاء الشركة والبدء' : 'إنشاء الحساب'}
      </Button>
      {tab === 'login' && (
        <button type="button" className="link-btn" onClick={() => void forgot()}>
          نسيت كلمة المرور؟
        </button>
      )}
    </form>
  );
}

function VerifyPanel() {
  const { email, pendingInvite, resendVerification, recheckVerification, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <div className="col center" style={{ gap: '1rem', alignItems: 'center' }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="auth-big-ico">
        <MailCheck size={40} />
      </motion.div>
      <h2>فعّل بريدك الإلكتروني</h2>
      <p className="muted">
        دعتك الشركة للانضمام كـ <b>{pendingInvite ? ROLE_LABELS[pendingInvite.role] : 'موظف'}</b>. أرسلنا رابط التفعيل إلى <b className="ltr">{email}</b>. بعد الضغط عليه عُد هنا واضغط «تحقّقت».
      </p>
      {msg && <div className="callout info">{msg}</div>}
      <Button
        variant="primary"
        block
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await recheckVerification();
            setMsg('لم يتم التفعيل بعد. تأكد من فتح الرابط في رسالة البريد ثم أعد المحاولة.');
          } finally {
            setBusy(false);
          }
        }}
      >
        تحقّقت — تابع
      </Button>
      <div className="row">
        <Button variant="ghost" size="sm" onClick={() => void resendVerification().then(() => setMsg('أعدنا إرسال رسالة التفعيل.'))}>
          إعادة إرسال الرسالة
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          تسجيل خروج
        </Button>
      </div>
    </div>
  );
}

function NeedsCompanyPanel() {
  const { createCompany, signOut, email } = useAuth();
  const [company, setCompany] = useState('');
  const [demoData, setDemoData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="col"
      style={{ gap: '1rem' }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await createCompany({ companyName: company, withDemoData: demoData });
        } catch (err) {
          setError(authErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>إنشاء شركتك</h2>
      <p className="muted small">
        الحساب <b className="ltr">{email}</b> غير مرتبط بأي شركة. أنشئ شركة جديدة، أو اطلب من مدير شركتك دعوتك بهذا البريد.
      </p>
      <Field label="اسم الشركة">{(id) => <TextInput id={id} value={company} onChange={(e) => setCompany(e.target.value)} required />}</Field>
      <label className="check">
        <input type="checkbox" checked={demoData} onChange={(e) => setDemoData(e.target.checked)} />
        <span>ابدأ ببيانات تجريبية جاهزة</span>
      </label>
      {error && <div className="callout bad">{error}</div>}
      <Button type="submit" variant="primary" size="lg" block loading={busy}>
        إنشاء الشركة
      </Button>
      <Button variant="ghost" onClick={() => void signOut()}>
        تسجيل خروج
      </Button>
    </form>
  );
}

export function AuthPages() {
  const { mode, status } = useAuth();
  return (
    <div className="auth">
      <Hero />
      <section className="auth-panel">
        <motion.div className="auth-card" initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.1 }}>
          <div className="auth-card-head">
            <LogoTile animate />
            <div>
              <div className="brand-name"><Wordmark height={22} /></div>
              <div className="muted small">{status === 'needsCompany' ? 'خطوة أخيرة' : 'مرحبًا بك'}</div>
            </div>
            {mode === 'demo' && (
              <span className="badge violet" style={{ marginInlineStart: 'auto' }}>
                <WifiOff size={13} /> تجريبي
              </span>
            )}
          </div>
          {status === 'needsVerification' ? <VerifyPanel /> : status === 'needsCompany' ? <NeedsCompanyPanel /> : mode === 'demo' ? <DemoStart /> : <FirebaseForms />}
          <div className="auth-foot">
            <CheckCircle2 size={14} /> بياناتك مشفّرة ومعزولة لكل شركة
          </div>
        </motion.div>
      </section>
    </div>
  );
}
