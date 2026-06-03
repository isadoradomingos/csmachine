import os

os.makedirs("src/app/api/update-email", exist_ok=True)

content = '''import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { user_id, email } = await request.json();

    if (!user_id || !email) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
'''

with open("src/app/api/update-email/route.ts", "w") as f:
    f.write(content)
print("API route criada!")
