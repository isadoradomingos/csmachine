"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// A visão da carteira de um CSM foi unificada com o dashboard real.
// Esta rota agora redireciona para /dashboard?csm=ID, evitando duplicação de tela.
export default function CsmRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/dashboard?csm=${id}`);
  }, [router, id]);

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Abrindo carteira do CSM...</p>
    </div>
  );
}
