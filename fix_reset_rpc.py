
with open("src/app/login/page.tsx", "r") as f:
    content = f.read()

old = '''  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetStatus("loading");

    // Verificar se o e-mail existe no sistema
    const { data: users } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: resetEmail,
      password: "verificacao_temporaria_xkq92",
    });

    // Se o erro for "Invalid login credentials" o email existe mas senha errada
    // Se for outro erro, o email não existe
    const emailExists = error?.message === "Invalid login credentials";

    if (!emailExists) {
      setResetStatus("notfound");
      return;
    }

    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setResetStatus("success");
  }'''

new = '''  async function handleReset(e: React.FormEvent) {
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
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setResetStatus("success");
  }'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/login/page.tsx", "w") as f:
        f.write(content)
    print("Corrigido!")
else:
    print("Trecho não encontrado — tentando alternativa")
    # Tentar encontrar qualquer versão da função
    idx = content.find("async function handleReset")
    if idx >= 0:
        print("Função encontrada em:", idx)
        print(repr(content[idx:idx+200]))
