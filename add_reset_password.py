with open("src/app/login/page.tsx", "r") as f:
    content = f.read()

# Adicionar estado para o modo de redefinição
old_state = '''  const [mounted, setMounted] = useState(false);'''
new_state = '''  const [mounted, setMounted] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<"idle" | "success" | "notfound" | "loading">("idle");'''

content = content.replace(old_state, new_state)

# Adicionar função de redefinição
old_func = '''  async function handleLogin(e: React.FormEvent) {'''
new_func = '''  async function handleReset(e: React.FormEvent) {
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
  }

  async function handleLogin(e: React.FormEvent) {'''

content = content.replace(old_func, new_func)

# Adicionar link "Esqueci minha senha" no formulário
old_btn = '''                <div className="lr-fade">
                  <button type="submit" className="lr-btn" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar →"}
                  </button>
                </div>'''

new_btn = '''                <div className="lr-fade">
                  <button type="submit" className="lr-btn" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar →"}
                  </button>
                </div>

                <div className="lr-fade" style={{textAlign:"center", marginTop:16}}>
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setResetStatus("idle"); setResetEmail(""); }}
                    style={{fontSize:13,color:"#aaa",background:"none",border:"none",cursor:"pointer",fontFamily:"Montserrat, sans-serif",fontWeight:500}}
                  >
                    Esqueci minha senha
                  </button>
                </div>'''

content = content.replace(old_btn, new_btn)

# Adicionar o formulário de reset antes do formulário de login
old_form = '''              <form onSubmit={handleLogin}>'''
new_form = '''              {resetMode ? (
                <div>
                  {resetStatus === "success" ? (
                    <div style={{padding:"24px",background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:12,textAlign:"center"}}>
                      <p style={{fontSize:14,color:"#166534",fontWeight:600,marginBottom:8}}>E-mail enviado!</p>
                      <p style={{fontSize:13,color:"#166534"}}>Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.</p>
                      <button onClick={() => { setResetMode(false); setResetStatus("idle"); }} style={{marginTop:16,fontSize:13,color:"#aaa",background:"none",border:"none",cursor:"pointer",fontFamily:"Montserrat, sans-serif"}}>← Voltar ao login</button>
                    </div>
                  ) : (
                    <form onSubmit={handleReset}>
                      <p style={{fontSize:14,color:"#888",marginBottom:24,lineHeight:1.6}}>Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>
                      <div className="lr-field">
                        <label className="lr-label">E-mail</label>
                        <input
                          type="email"
                          className="lr-input"
                          value={resetEmail}
                          onChange={e => setResetEmail(e.target.value)}
                          placeholder="seu@email.com"
                          required
                        />
                      </div>
                      {resetStatus === "notfound" && (
                        <div style={{padding:"12px 16px",background:"#fff5f5",border:"1px solid #ffdede",borderRadius:10,marginBottom:16,fontSize:13,color:"#b91c1c",lineHeight:1.6}}>
                          Este e-mail não está cadastrado na plataforma. Entre em contato com um administrador para solicitar acesso.
                        </div>
                      )}
                      <button type="submit" className="lr-btn" disabled={resetStatus === "loading"}>
                        {resetStatus === "loading" ? "Enviando..." : "Enviar link →"}
                      </button>
                      <div style={{textAlign:"center",marginTop:16}}>
                        <button type="button" onClick={() => { setResetMode(false); setResetStatus("idle"); }} style={{fontSize:13,color:"#aaa",background:"none",border:"none",cursor:"pointer",fontFamily:"Montserrat, sans-serif"}}>← Voltar ao login</button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
              <form onSubmit={handleLogin}>'''

content = content.replace(old_form, new_form)

# Fechar o bloco condicional após o formulário de login
old_form_end = '''              </form>

              <div className="lr-fade lr-footer">'''
new_form_end = '''              </form>
              )}

              <div className="lr-fade lr-footer">'''

content = content.replace(old_form_end, new_form_end)

with open("src/app/login/page.tsx", "w") as f:
    f.write(content)
print("Atualizado!")
