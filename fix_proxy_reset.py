with open("src/proxy.ts", "r") as f:
    content = f.read()

old = '''  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }'''

new = '''  const publicPaths = ["/login", "/reset-password"];
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }'''

if old in content:
    content = content.replace(old, new)
    with open("src/proxy.ts", "w") as f:
        f.write(content)
    print("Corrigido!")
else:
    print("Trecho não encontrado!")
