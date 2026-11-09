"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Dumbbell, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirebaseClientAuth, isFirebaseClientConfigured } from "@/lib/firebase-client";
import type { GymAccount, GymAppUser } from "@/lib/gym-data";
import { Button } from "@/components/ui";

type Props = {
  onAuthenticated: (profile: GymAppUser, gym: GymAccount | null) => Promise<void>;
};

type AuthResponse = {
  error?: string;
  registrationRequired?: boolean;
};

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
  const data = await response.json() as { profile?: GymAppUser; gym?: GymAccount | null; error?: string };
  if (!response.ok || !data.profile) throw new Error(data.error ?? "تعذر تحميل بيانات الحساب.");
  return data;
}

function googleSignInError(reason: unknown) {
  const code = typeof reason === "object" && reason !== null && "code" in reason
    ? String(reason.code)
    : "";
  if (code === "auth/popup-closed-by-user") {
    return "اتقفلت نافذة Google قبل ما الدخول يكتمل. اضغط تاني، اختار حسابك، وسيب النافذة مفتوحة لحد ما يرجعك للنظام.";
  }
  if (code === "auth/popup-blocked") {
    return "المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة للموقع وحاول تاني.";
  }
  return reason instanceof Error ? reason.message : "تعذر الدخول بحساب Google.";
}

export function AuthGate({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"owner" | "employee" | "register">("owner");
  const [idToken, setIdToken] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [gymName, setGymName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function showMode(nextMode: typeof mode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function googleSignIn() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!isFirebaseClientConfigured()) throw new Error("الدخول غير متاح حاليًا. حاول مرة أخرى لاحقًا.");
      const auth = getFirebaseClientAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      const response = await postJson("/api/auth/google", { idToken: token });
      if (response.registrationRequired) {
        setIdToken(token);
        setGoogleEmail(result.user.email ?? "");
        setOwnerName(result.user.displayName ?? "");
        setMode("register");
        return;
      }

      await signOut(auth);
      const session = await loadSession();
      await onAuthenticated(session.profile!, session.gym ?? null);
    } catch (reason) {
      setError(googleSignInError(reason));
    } finally {
      setBusy(false);
    }
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
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/register", { idToken, username, password, gymName, ownerName });
      await postJson("/api/auth/google", { idToken });
      const session = await loadSession();
      await signOut(getFirebaseClientAuth());
      await onAuthenticated(session.profile!, session.gym ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تسجيل النادي.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-layout">
        <aside className="auth-aside">
          <div className="auth-aside-brand">
            <span className="auth-brand-mark"><Dumbbell size={19} /></span>
            <span>Gym<span>Flow</span></span>
          </div>
          <div className="auth-aside-copy">
            <span className="auth-aside-kicker">إدارة ناديك ببساطة</span>
            <h2>خلّي تركيزك<br />على التمرين.</h2>
            <p>الأعضاء والاشتراكات والحضور، كلهم في مكان واحد.</p>
            <div className="auth-benefits">
              <span><UsersRoundIcon /> ملفات الأعضاء والاشتراكات</span>
              <span><ShieldCheck size={17} /> حساب مستقل لكل نادٍ</span>
            </div>
          </div>
          <div className="auth-aside-footer"><span /> نظام إدارة GymFlow</div>
        </aside>

        <section className="auth-panel" aria-live="polite">
          <div className="auth-mobile-brand">
            <span className="auth-brand-mark"><Dumbbell size={18} /></span>
            <span>Gym<span>Flow</span></span>
          </div>

          {mode === "owner" && <>
            <span className="auth-step">دخول مالك النادي</span>
            <h1>أهلاً بعودتك</h1>
            <p className="auth-description">ادخل بحساب Google المرتبط بناديك.</p>
            <Button className="auth-primary auth-google-button" onClick={googleSignIn} disabled={busy || !isFirebaseClientConfigured()}>
              <GoogleMark />
              <span>{busy ? "جارٍ التحقق..." : "الدخول باستخدام Google"}</span>
            </Button>
            <p className="auth-caption"><LockKeyhole size={13} /> دخول آمن إلى مساحة ناديك</p>
            <div className="auth-separator"><span>أول مرة هنا؟</span></div>
            <button className="auth-secondary-action" onClick={() => showMode("register")}>سجّل ناديك الجديد <ArrowRight size={15} /></button>
            <button className="auth-employee-link" onClick={() => showMode("employee")}><UserRound size={16} /> أنا موظف — الدخول باسم المستخدم</button>
          </>}

          {mode === "employee" && <>
            <button className="auth-back" onClick={() => showMode("owner")}><ArrowRight size={15} /> العودة</button>
            <span className="auth-step">دخول الموظفين</span>
            <h1>مساحة فريقك</h1>
            <p className="auth-description">استخدم بيانات الدخول التي أنشأها مالك النادي.</p>
            <form className="auth-form" onSubmit={employeeLogin}>
              <label className="auth-field"><span>اسم المستخدم</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required autoFocus /></label>
              <label className="auth-field"><span>كلمة المرور</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <Button className="auth-primary" type="submit" disabled={busy}>{busy ? "جارٍ الدخول..." : "تسجيل الدخول"}</Button>
            </form>
            <p className="auth-caption"><LockKeyhole size={13} /> صلاحياتك يحددها مالك النادي</p>
          </>}

          {mode === "register" && <>
            <button className="auth-back" onClick={() => { showMode("owner"); setIdToken(""); }}><ArrowRight size={15} /> العودة</button>
            <span className="auth-step">حساب جديد</span>
            <h1>{idToken ? "كمّل تسجيل ناديك" : "ابدأ مع GymFlow"}</h1>
            <p className="auth-description">{idToken ? "بيانات ناديك وحساب الإدارة." : "تحقق من حساب Google للبدء."}</p>
            {idToken ? (
              <>
                {googleEmail && <div className="auth-google-account"><GoogleMark /><span><small>حساب Google</small><strong dir="ltr">{googleEmail}</strong></span></div>}
                <form className="auth-form" onSubmit={register}>
                  <label className="auth-field"><span>اسم النادي</span><input value={gymName} onChange={(event) => setGymName(event.target.value)} required maxLength={100} autoFocus /></label>
                  <label className="auth-field"><span>اسم المالك</span><input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} required maxLength={100} /></label>
                  <label className="auth-field"><span>اسم المستخدم للإدارة</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]+" dir="ltr" /></label>
                  <label className="auth-field"><span>كلمة المرور <small>(٨ أحرف على الأقل)</small></span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} /></label>
                  {error && <p className="auth-error" role="alert">{error}</p>}
                  <Button className="auth-primary" type="submit" disabled={busy}>{busy ? "جارٍ إنشاء الحساب..." : "إرسال طلب التسجيل"}</Button>
                </form>
                <p className="auth-caption"><ShieldCheck size={13} /> يُفعّل النادي بعد مراجعة الاشتراك</p>
              </>
            ) : <>
              <Button className="auth-primary auth-google-button" onClick={googleSignIn} disabled={busy || !isFirebaseClientConfigured()}>
                <GoogleMark />
                <span>{busy ? "جارٍ التحقق..." : "المتابعة باستخدام Google"}</span>
              </Button>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-employee-link" onClick={() => showMode("owner")}>لديك حساب؟ تسجيل الدخول</button>
            </>}
          </>}
          {error && mode !== "employee" && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {!isFirebaseClientConfigured() && mode !== "employee" && <p className="auth-error" role="status">الدخول باستخدام Google غير متاح حاليًا.</p>}
        </section>
      </section>
    </main>
  );
}

function GoogleMark() {
  return <span className="google-mark" aria-hidden="true">G</span>;
}

function UsersRoundIcon() {
  return <span className="auth-benefit-icon"><UserRound size={15} /></span>;
}
