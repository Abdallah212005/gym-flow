"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import type { GymAccount, GymAppUser } from "@/lib/gym-data";
import { Button } from "@/components/ui";

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

type Props = {
  onAuthenticated: (profile: GymAppUser, gym: GymAccount | null) => Promise<void>;
};

type AuthResponse = {
  error?: string;
  registrationRequired?: boolean;
};

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = await response.json() as AuthResponse;
  if (!response.ok) throw new Error(data.error ?? "تعذر تسجيل الدخول.");
  return data;
}

async function loadSession() {
  const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
  const data = await response.json() as { profile?: GymAppUser | null; gym?: GymAccount | null; error?: string };
  if (!response.ok || !data.profile) throw new Error(data.error ?? "تعذر تحميل بيانات الحساب.");
  return data;
}

export function AuthGate({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"owner" | "employee" | "register">("owner");
  const [googleEmail, setGoogleEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [gymName, setGymName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hasAuthError = new URLSearchParams(window.location.search).has("authError");
    if (hasAuthError) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as {
          registrationRequired?: boolean;
          email?: string;
          displayName?: string;
        };
        if (hasAuthError) {
          setError("تعذر تسجيل الدخول باستخدام Google. تحقق من إعدادات Supabase Auth وحاول مرة أخرى.");
        }
        if (response.ok && data.registrationRequired) {
          setGoogleEmail(data.email ?? "");
          setOwnerName(data.displayName ?? "");
          setMode("register");
        }
      })
      .catch(() => setError("تعذر التحقق من جلسة الدخول. أعد المحاولة."));
  }, []);

  function showMode(nextMode: typeof mode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function googleSignIn() {
    setError("");
    setNotice("");
    if (!isSupabaseConfigured) {
      setError("الدخول غير متاح حاليًا. تحقق من إعدادات Supabase.");
      return;
    }
    setBusy(true);
    window.location.assign(new URL("/api/auth/google", window.location.href).toString());
  }

  async function employeeLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postJson("/api/auth/login", { username, password });
      const session = await loadSession();
      await onAuthenticated(session.profile!, session.gym ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تسجيل الدخول.");
    } finally {
      setBusy(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const normalizedUsername = username.trim().toLowerCase();
    if (!usernamePattern.test(normalizedUsername)) {
      setError("اسم المستخدم يجب أن يتكون من 3 إلى 32 حرفًا، ويقبل الحروف الإنجليزية والأرقام والنقطة والشرطة والشرطة السفلية.");
      return;
    }
    if (password.length < 8) {
      setError("كلمة المرور يجب ألا تقل عن 8 أحرف.");
      return;
    }
    if (!gymName.trim() || !ownerName.trim()) {
      setError("اكتب اسم النادي واسم المالك.");
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/auth/register", {
        username: normalizedUsername,
        password,
        gymName: gymName.trim(),
        ownerName: ownerName.trim(),
      });
      const session = await loadSession();
      await onAuthenticated(session.profile!, session.gym ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تسجيل النادي.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" dir="rtl">
      <div className="auth-ambient" aria-hidden="true" />
      <div className="auth-container">
        <section className={`auth-card auth-login-card ${mode === "owner" ? "auth-login-owner" : ""}`} aria-live="polite">
          <div className="auth-branding">
            <Image className="auth-logo" src="/gymflow-logo.png" alt="GymFlow" width={609} height={122} priority />
          </div>

          {mode === "owner" && <>
            <div className="auth-welcome">
              <h1>تسجيل الدخول</h1>
              <p>مرحباً بك مجدداً في نظام GymFlow لإدارة ناديك الرياضي</p>
            </div>
            <Button className="auth-primary auth-google-button" onClick={googleSignIn} disabled={busy || !isSupabaseConfigured}>
              <GoogleMark />
              <span>{busy ? "جارٍ التحويل..." : "المتابعة باستخدام Google"}</span>
            </Button>
            <div className="auth-separator"><span>أو</span></div>
            <button className="auth-secondary-action" onClick={() => showMode("employee")}>
              <UserRound size={18} aria-hidden="true" />
              <span>الدخول باسم المستخدم وكلمة المرور</span>
            </button>
            <div className="auth-register-prompt">
              <p>ليس لديك نادٍ مسجل حتى الآن؟</p>
              <button className="auth-register-link" onClick={() => showMode("register")}>
                <span>سجّل ناديك الجديد وابدأ مجاناً</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </>}

          {mode === "employee" && <>
            <button className="auth-back" onClick={() => showMode("owner")}><ArrowRight size={15} /> العودة لتسجيل الدخول</button>
            <div className="auth-welcome">
              <h1>مساحة فريقك</h1>
              <p>استخدم بيانات الدخول التي أنشأها مالك النادي.</p>
            </div>
            <form className="auth-form" onSubmit={employeeLogin}>
              <label className="auth-field"><span>اسم المستخدم</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required autoFocus /></label>
              <label className="auth-field"><span>كلمة المرور</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <Button className="auth-primary" type="submit" disabled={busy}>{busy ? "جارٍ الدخول..." : "تسجيل الدخول"}</Button>
            </form>
            <p className="auth-caption"><LockKeyhole size={13} /> صلاحياتك يحددها مالك النادي</p>
          </>}

          {mode === "register" && <>
            <button className="auth-back" onClick={() => showMode("owner")}><ArrowRight size={15} /> العودة لتسجيل الدخول</button>
            <div className="auth-welcome">
              <h1>{googleEmail ? "كمّل تسجيل ناديك" : "ابدأ مع GymFlow"}</h1>
              <p>{googleEmail ? "بيانات ناديك وحساب الإدارة." : "تحقق من حساب Google للبدء."}</p>
            </div>
            {googleEmail ? (
              <>
                {googleEmail && <div className="auth-google-account"><GoogleMark /><span><small>حساب Google</small><strong dir="ltr">{googleEmail}</strong></span></div>}
                <form className="auth-form" onSubmit={register}>
                  <label className="auth-field"><span>اسم النادي</span><input value={gymName} onChange={(event) => setGymName(event.target.value)} required maxLength={100} autoFocus /></label>
                  <label className="auth-field"><span>اسم المالك</span><input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} required maxLength={100} /></label>
                  <label className="auth-field"><span>اسم المستخدم للإدارة</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z0-9._\x2D]{3,32}" title="من 3 إلى 32 حرفًا: حروف إنجليزية أو أرقام أو . أو - أو _" dir="ltr" /></label>
                  <p className="auth-field-hint">من 3 إلى 32 حرفًا، ويقبل الحروف الإنجليزية والأرقام والنقطة والشرطة والشرطة السفلية.</p>
                  <label className="auth-field"><span>كلمة المرور <small>(٨ أحرف على الأقل)</small></span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} /></label>
                  {error && <p className="auth-error" role="alert">{error}</p>}
                  <Button className="auth-primary" type="submit" disabled={busy}>{busy ? "جارٍ إنشاء الحساب..." : "إرسال طلب التسجيل"}</Button>
                </form>
                <p className="auth-caption"><ShieldCheck size={13} /> يُفعّل النادي بعد مراجعة الاشتراك</p>
              </>
            ) : <>
              <Button className="auth-primary auth-google-button" onClick={googleSignIn} disabled={busy || !isSupabaseConfigured}>
                <GoogleMark />
                <span>{busy ? "جارٍ التحويل..." : "المتابعة باستخدام Google"}</span>
              </Button>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-employee-link" onClick={() => showMode("owner")}>لديك حساب؟ تسجيل الدخول</button>
            </>}
          </>}
          {error && mode === "owner" && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {!isSupabaseConfigured && mode !== "employee" && <p className="auth-error" role="status">الدخول باستخدام Google غير متاح حاليًا.</p>}
        </section>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
    </svg>
  );
}
