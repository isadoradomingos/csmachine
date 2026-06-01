with open("src/proxy.ts", "r") as f:
    content = f.read()

old = '''export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};'''

new = '''export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.webp|.*\\.ico|.*\\.csv).*)"],
};'''

if old in content:
    content = content.replace(old, new)
    with open("src/proxy.ts", "w") as f:
        f.write(content)
    print("Corrigido!")
else:
    print("Trecho não encontrado")
    print(repr(content[-200:]))
