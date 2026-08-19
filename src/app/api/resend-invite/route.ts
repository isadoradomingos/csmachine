import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
    }

    const { data, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);

    if (getUserError || !data?.user?.email) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const email = data.user.email;

    // Usuário nunca confirmou o convite: reenvia o convite original.
    // Usuário já definiu senha alguma vez: manda um link de redefinição de senha.
    const { error } = data.user.email_confirmed_at
      ? await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: "https://csmachine.vercel.app/reset-password",
        })
      : await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
