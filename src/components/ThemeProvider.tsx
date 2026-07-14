"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Tema = "light" | "dark";

type ThemeContextType = {
  tema: Tema;
  alternarTema: () => void;
  definirTema: (t: Tema) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  tema: "dark",
  alternarTema: () => {},
  definirTema: () => {},
});

export function useTema() {
  return useContext(ThemeContext);
}

// Aplica/remove a classe .dark no <html>
function aplicarClasse(t: Tema) {
  if (typeof document === "undefined") return;
  if (t === "dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Estado inicial: o que já está aplicado no <html> pelo script anti-flash
  const [tema, setTema] = useState<Tema>("dark");

  // Ao montar, sincroniza com o que o script anti-flash já aplicou (localStorage)
  useEffect(() => {
    let t: Tema = "dark";
    try {
      const salvo = localStorage.getItem("tema");
      if (salvo === "light" || salvo === "dark") t = salvo;
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(t);
    aplicarClasse(t);

    // Depois, busca a preferência do banco (fonte da verdade entre dispositivos)
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("tema").eq("id", user.id).single();
      const doBanco = profile?.tema;
      if ((doBanco === "light" || doBanco === "dark") && doBanco !== t) {
        setTema(doBanco);
        aplicarClasse(doBanco);
        try { localStorage.setItem("tema", doBanco); } catch {}
      }
    })();
  }, []);

  const definirTema = useCallback((t: Tema) => {
    setTema(t);
    aplicarClasse(t);
    try { localStorage.setItem("tema", t); } catch {}
    // Persiste no banco (não bloqueia a UI)
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("profiles").update({ tema: t }).eq("id", user.id);
    })();
  }, []);

  const alternarTema = useCallback(() => {
    definirTema(tema === "dark" ? "light" : "dark");
  }, [tema, definirTema]);

  return (
    <ThemeContext.Provider value={{ tema, alternarTema, definirTema }}>
      {children}
    </ThemeContext.Provider>
  );
}
