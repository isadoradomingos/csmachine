with open("src/app/reset-password/page.tsx", "r") as f:
    content = f.read()

# Corrigir redirecionamento para login
old_redirect = '''    setStatus("success");
    setTimeout(() => router.push("/dashboard"), 3000);'''

new_redirect = '''    setStatus("success");
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 3000);'''

content = content.replace(old_redirect, new_redirect)

# Corrigir validações de senha
old_validation = '''    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }'''

new_validation = '''    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("A senha deve conter letras e números.");
      return;
    }'''

content = content.replace(old_validation, new_validation)

# Atualizar mensagem de sucesso
old_success = '''              <p style={{ fontSize: 14, color: "#aaa" }}>Você será redirecionado em instantes...</p>'''
new_success = '''              <p style={{ fontSize: 14, color: "#aaa" }}>Você será redirecionado para o login em instantes...</p>'''

content = content.replace(old_success, new_success)

# Adicionar requisitos visíveis abaixo do campo de senha
old_input_hint = '''                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Confirmar senha</label>'''

new_input_hint = '''                  <p style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>Mínimo 8 caracteres, com letras e números</p>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Confirmar senha</label>'''

content = content.replace(old_input_hint, new_input_hint)

with open("src/app/reset-password/page.tsx", "w") as f:
    f.write(content)
print("Atualizado!")
