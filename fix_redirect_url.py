with open("src/app/login/page.tsx", "r") as f:
    content = f.read()

old = '''    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });'''

new = '''    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: "https://csmachine.vercel.app/reset-password",
    });'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/login/page.tsx", "w") as f:
        f.write(content)
    print("Corrigido!")
else:
    print("Trecho não encontrado!")
