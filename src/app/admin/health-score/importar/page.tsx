"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// A importação foi unificada na tela principal do Health Score.
// Esta rota antiga agora apenas redireciona para lá.
export default function ImportarRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/health-score");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Redirecionando para o Health Score...</p>
    </div>
  );
}
