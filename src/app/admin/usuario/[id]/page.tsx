"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// A visão de carteira do usuário foi unificada com o dashboard, e a edição
// agora acontece no próprio Painel de Gestão. Esta rota redireciona para a carteira.
export default function UsuarioRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/dashboard?csm=${id}`);
  }, [router, id]);

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Abrindo carteira...</p>
    </div>
  );
}
