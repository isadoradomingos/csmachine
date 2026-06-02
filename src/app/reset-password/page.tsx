"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // O Supabase processa o token da URL automaticamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setStatus("loading");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setStatus("error");
      return;
    }

    setStatus("success");
    setTimeout(() => router.push("/dashboard"), 3000);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Montserrat', sans-serif; background: #f5f5f5; }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Montserrat, sans-serif", background: "#f5f5f5" }}>
        <div style={{ background: "white", borderRadius: 20, border: "1.5px solid #ebebeb", padding: "40px 36px", width: "100%", maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
            <img src="/machine-logo.png" alt="Machine" style={{ width: 32, height: 32, objectFit: "contain" }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Machine</span>
          </div>

          {/* Barra colorida */}
          <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 99, background: "#E53935" }} />
            <div style={{ flex: 1, height: 3, borderRadius: 99, background: "#FFC107" }} />
            <div style={{ flex: 1, height: 3, borderRadius: 99, background: "#29B6F6" }} />
          </div>

          {status === "success" ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 8 }}>Senha redefinida!</h2>
              <p style={{ fontSize: 14, color: "#aaa" }}>Você será redirecionado em instantes...</p>
            </div>
          ) : !ready ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p style={{ fontSize: 14, color: "#aaa" }}>Validando link de redefinição...</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#111", letterSpacing: -1, marginBottom: 6 }}>Nova senha</h2>
              <p style={{ fontSize: 14, color: "#aaa", marginBottom: 28 }}>Escolha uma nova senha para sua conta.</p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Nova senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{ width: "100%", padding: "13px 16px", border: "1.5px solid #ebebeb", borderRadius: 10, fontSize: 14, fontFamily: "Montserrat, sans-serif", outline: "none", background: "#fafafa" }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Confirmar senha</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{ width: "100%", padding: "13px 16px", border: "1.5px solid #ebebeb", borderRadius: 10, fontSize: 14, fontFamily: "Montserrat, sans-serif", outline: "none", background: "#fafafa" }}
                  />
                </div>

                {(error || status === "error") && (
                  <div style={{ fontSize: 13, color: "#E53935", background: "#fff5f5", border: "1px solid #ffdede", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  style={{ width: "100%", padding: 15, background: "#111", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: "Montserrat, sans-serif", cursor: "pointer", opacity: status === "loading" ? 0.6 : 1 }}
                >
                  {status === "loading" ? "Salvando..." : "Redefinir senha →"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
