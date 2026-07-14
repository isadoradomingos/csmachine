"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useTema } from "@/components/ThemeProvider";

export default function MenuLateral() {
  const router = useRouter();
  const { tema, alternarTema } = useTema();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [statusReset, setStatusReset] = useState<"idle" | "enviando" | "enviado" | "erro">("idle");

  useEffect(() => {
    if (!aberto) return;
    // Carrega dados do usuário logado só quando o menu abre
    let ativo = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !ativo) return;
      setEmail(user.email ?? "");
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (ativo && profile) setNome(profile.full_name ?? "");
      const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (ativo) setRoles((userRoles ?? []).map((r: { role: string }) => r.role));
    })();
    return () => { ativo = false; };
  }, [aberto]);

  async function redefinirSenha() {
    if (!email) return;
    setStatusReset("enviando");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://csmachine.vercel.app/reset-password",
    });
    setStatusReset(error ? "erro" : "enviado");
  }

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const rotuloCargo = (r: string) => (r === "admin" ? "Admin" : r === "csm" ? "CSM" : r);

  return (
    <>
      {/* Botão hambúrguer */}
      <button
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-200/70 transition-colors"
      >
        <svg className="h-5 w-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Overlay + painel deslizante */}
      {aberto && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setAberto(false)} />
          <div className="fixed top-0 left-0 h-full w-72 max-w-[80vw] bg-white z-50 shadow-xl flex flex-col animate-[slideIn_0.2s_ease-out]">
            <style>{`@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>

            {/* Cabeçalho com dados do usuário */}
            <div className="px-5 py-6 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-900">Menu</span>
                <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {nome ? nome.split(" ").map(n => n[0]).slice(0, 2).join("") : "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{nome || "Carregando..."}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {roles.map(r => (
                      <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${r === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {rotuloCargo(r)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex-1 px-3 py-4 space-y-1">
              <button
                onClick={redefinirSenha}
                disabled={statusReset === "enviando" || statusReset === "enviado"}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-slate-100 transition-colors text-left disabled:opacity-60"
              >
                <svg className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {statusReset === "enviado" ? "Link enviado ao seu e-mail" : statusReset === "enviando" ? "Enviando..." : "Redefinir senha"}
              </button>
              {statusReset === "enviado" && (
                <p className="text-xs text-green-600 px-3">Enviamos um link de redefinição para {email}.</p>
              )}
              {statusReset === "erro" && (
                <p className="text-xs text-red-500 px-3">Não foi possível enviar o link. Tente novamente.</p>
              )}

              {/* Alternar tema claro/escuro */}
              <button
                onClick={alternarTema}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-slate-100 transition-colors text-left"
              >
                {tema === "dark" ? (
                  <svg className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
                {tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
              </button>
            </div>

            {/* Rodapé: sair */}
            <div className="px-3 py-4 border-t border-slate-100">
              <button onClick={sair} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors text-left">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sair
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
