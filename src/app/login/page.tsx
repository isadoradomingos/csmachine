"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<"idle" | "success" | "notfound" | "loading">("idle");

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetStatus("loading");

    // Verificar se o e-mail existe usando função segura do banco
    const { data: exists } = await supabase
      .rpc("check_email_exists", { email_input: resetEmail });

    if (!exists) {
      setResetStatus("notfound");
      return;
    }

    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: "https://csmachine.vercel.app/reset-password",
    });

    setResetStatus("success");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id)
      .eq("role", "admin")
      .single();

    if (role) {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lr {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 480px;
          font-family: 'Montserrat', sans-serif;
        }

        /* ── LEFT PANEL ── */
        .lr-left {
          background: #080808;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 60px;
          overflow: hidden;
        }

        /* dot grid */
        .lr-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
        }

        /* color glows */
        .lr-left::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 55% 40% at 15% 15%, rgba(229,57,53,0.18) 0%, transparent 65%),
            radial-gradient(ellipse 45% 55% at 85% 85%, rgba(41,182,246,0.16) 0%, transparent 65%),
            radial-gradient(ellipse 35% 35% at 70% 20%, rgba(255,193,7,0.12) 0%, transparent 55%);
          pointer-events: none;
        }

        .lr-logo {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .lr-logo-icon {
          width: 36px;
          height: 36px;
        }

        .lr-logo-name {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.3px;
        }

        .lr-hero {
          position: relative;
          z-index: 2;
        }

        .lr-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .lr-eyebrow::before {
          content: '';
          width: 24px;
          height: 1.5px;
          background: rgba(255,255,255,0.25);
        }

        .lr-headline {
          font-size: 58px;
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: -3px;
          color: #fff;
          margin-bottom: 28px;
        }

        .lr-headline .accent-r { color: #E53935; }
        .lr-headline .accent-y { color: #FFC107; }
        .lr-headline .accent-b { color: #29B6F6; }

        .lr-desc {
          font-size: 15px;
          color: rgba(255,255,255,0.38);
          line-height: 1.7;
          max-width: 380px;
          font-weight: 400;
        }

        .lr-stats {
          position: relative;
          z-index: 2;
          display: flex;
          gap: 40px;
        }

        .lr-stat-value {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -1px;
          line-height: 1;
        }

        .lr-stat-label {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          margin-top: 4px;
          font-weight: 500;
          letter-spacing: 0.3px;
        }

        .lr-stat-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          margin-bottom: 10px;
        }

        /* floating shapes */
        .lr-shape {
          position: absolute;
          z-index: 1;
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
        }

        .lr-shape-1 {
          width: 300px; height: 300px;
          background: rgba(229,57,53,0.08);
          top: -80px; right: -80px;
        }

        .lr-shape-2 {
          width: 200px; height: 200px;
          background: rgba(41,182,246,0.08);
          bottom: 100px; right: 60px;
        }

        /* big watermark logo */
        .lr-watermark {
          position: absolute;
          right: -40px;
          bottom: -40px;
          width: 320px;
          height: 320px;
          opacity: 0.04;
          z-index: 1;
          pointer-events: none;
        }

        /* ── RIGHT PANEL ── */
        .lr-right {
          background: #fff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 64px 56px;
          position: relative;
        }

        .lr-right::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #E53935 0%, #FFC107 50%, #29B6F6 100%);
        }

        .lr-form-logo {
          display: none;
          margin-bottom: 32px;
        }

        .lr-form-title {
          font-size: 30px;
          font-weight: 800;
          color: #111;
          letter-spacing: -1.2px;
          margin-bottom: 6px;
        }

        .lr-form-sub {
          font-size: 14px;
          color: #aaa;
          font-weight: 400;
          margin-bottom: 40px;
        }

        .lr-field {
          margin-bottom: 18px;
        }

        .lr-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .lr-input {
          width: 100%;
          padding: 14px 18px;
          border: 1.5px solid #ebebeb;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'Montserrat', sans-serif;
          color: #111;
          background: #fafafa;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          outline: none;
          font-weight: 500;
        }

        .lr-input::placeholder { color: #ccc; font-weight: 400; }

        .lr-input:focus {
          border-color: #111;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(0,0,0,0.04);
        }

        .lr-error {
          font-size: 13px;
          color: #E53935;
          background: #fff5f5;
          border: 1px solid #ffdede;
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 18px;
          font-weight: 500;
        }

        .lr-btn {
          width: 100%;
          padding: 16px;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Montserrat', sans-serif;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
          margin-top: 8px;
        }

        .lr-btn:hover:not(:disabled) {
          background: #1a1a1a;
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.18);
        }

        .lr-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .lr-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .lr-footer {
          margin-top: 40px;
          font-size: 12px;
          color: #ccc;
          text-align: center;
        }

        /* animation */
        .lr-fade {
          opacity: 0;
          transform: translateY(16px);
          animation: fadeUp 0.5s forwards;
        }

        @keyframes fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }

        .lr-fade:nth-child(1) { animation-delay: 0.05s; }
        .lr-fade:nth-child(2) { animation-delay: 0.12s; }
        .lr-fade:nth-child(3) { animation-delay: 0.18s; }
        .lr-fade:nth-child(4) { animation-delay: 0.24s; }
        .lr-fade:nth-child(5) { animation-delay: 0.30s; }

        @media (max-width: 900px) {
          .lr { grid-template-columns: 1fr; }
          .lr-left { display: none; }
          .lr-right { padding: 48px 32px; }
          .lr-form-logo { display: flex; align-items: center; gap: 10px; }
        }
      `}</style>

      <div className="lr">
        {/* ── LEFT ── */}
        <div className="lr-left">
          <div className="lr-shape lr-shape-1" />
          <div className="lr-shape lr-shape-2" />

          {/* watermark */}
          <svg className="lr-watermark" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="90" stroke="white" strokeWidth="3"/>
            <circle cx="100" cy="100" r="55" stroke="white" strokeWidth="3"/>
            <line x1="10" y1="100" x2="190" y2="100" stroke="white" strokeWidth="2"/>
            <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="2"/>
          </svg>

          <div className="lr-logo">
            <img src="/machine-logo.png" alt="Machine" className="lr-logo-icon" />
            <span className="lr-logo-name">Machine</span>
          </div>

          <div className="lr-hero">
            <p className="lr-eyebrow">Portal interno</p>
            <h1 className="lr-headline">
              Customer Success<br/>
              <span className="accent-r">Ma</span><span className="accent-y">chi</span><span className="accent-b">ne</span>
            </h1>
            <p className="lr-desc">
              Sua central de gestão de clientes.
            </p>
          </div>

          <p style={{fontSize:12,color:"rgba(255,255,255,0.2)",position:"relative",zIndex:2}}>
            Machine · Acesso restrito © {new Date().getFullYear()} 
          </p>
        </div>

        {/* ── RIGHT ── */}
        <div className="lr-right">
          <div className="lr-form-logo">
            <img src="/machine-logo.png" alt="Machine" style={{width:32,height:32,objectFit:"contain"}} />
            <span style={{fontSize:16,fontWeight:700,color:"#111"}}>Machine</span>
          </div>

          {mounted && (
            <>
              <div className="lr-fade">
                <h2 className="lr-form-title">Bem-vindo de volta</h2>
                <p className="lr-form-sub">Entre com suas credenciais para acessar</p>
              </div>

              {resetMode ? (
                <div>
                  {resetStatus === "success" ? (
                    <div style={{padding:"24px",background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:12,textAlign:"center"}}>
                      <p style={{fontSize:14,color:"#166534",fontWeight:600,marginBottom:8}}>E-mail enviado!</p>
                      <p style={{fontSize:13,color:"#166534"}}>Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.</p>
                      <button onClick={() => { setResetMode(false); setResetStatus("idle"); }} style={{marginTop:16,fontSize:13,color:"#aaa",background:"none",border:"none",cursor:"pointer",fontFamily:"Montserrat, sans-serif"}}>← Voltar ao login</button>
                    </div>
                  ) : (
                    <form onSubmit={handleReset}>
                      <p style={{fontSize:14,color:"#888",marginBottom:24,lineHeight:1.6}}>Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>
                      <div className="lr-field">
                        <label className="lr-label">E-mail</label>
                        <input
                          type="email"
                          className="lr-input"
                          value={resetEmail}
                          onChange={e => setResetEmail(e.target.value)}
                          placeholder="seu@email.com"
                          required
                        />
                      </div>
                      {resetStatus === "notfound" && (
                        <div style={{padding:"12px 16px",background:"#fff5f5",border:"1px solid #ffdede",borderRadius:10,marginBottom:16,fontSize:13,color:"#b91c1c",lineHeight:1.6}}>
                          Este e-mail não está cadastrado na plataforma. Entre em contato com um administrador para solicitar acesso.
                        </div>
                      )}
                      <button type="submit" className="lr-btn" disabled={resetStatus === "loading"}>
                        {resetStatus === "loading" ? "Enviando..." : "Enviar link →"}
                      </button>
                      <div style={{textAlign:"center",marginTop:16}}>
                        <button type="button" onClick={() => { setResetMode(false); setResetStatus("idle"); }} style={{fontSize:13,color:"#aaa",background:"none",border:"none",cursor:"pointer",fontFamily:"Montserrat, sans-serif"}}>← Voltar ao login</button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
              <form onSubmit={handleLogin}>
                <div className="lr-fade lr-field">
                  <label className="lr-label">E-mail</label>
                  <input
                    type="email"
                    className="lr-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div className="lr-fade lr-field">
                  <label className="lr-label">Senha</label>
                  <input
                    type="password"
                    className="lr-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div className="lr-fade lr-error">{error}</div>
                )}

                <div className="lr-fade">
                  <button type="submit" className="lr-btn" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar →"}
                  </button>
                </div>

                <div className="lr-fade" style={{textAlign:"center", marginTop:16}}>
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setResetStatus("idle"); setResetEmail(""); }}
                    style={{fontSize:13,color:"#aaa",background:"none",border:"none",cursor:"pointer",fontFamily:"Montserrat, sans-serif",fontWeight:500}}
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </form>
              )}

              <div className="lr-fade lr-footer">
                Machine · Acesso restrito © {new Date().getFullYear()}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
