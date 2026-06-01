with open("src/app/layout.tsx", "r") as f:
    content = f.read()

old = '''export const metadata: Metadata = {
  title: "CS Machine",
  description: "CRM interno CS Machine",
};'''

new = '''export const metadata: Metadata = {
  title: "CS Machine",
  description: "CRM interno CS Machine",
  icons: {
    icon: "/machine-logo.png",
    apple: "/machine-logo.png",
  },
};'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/layout.tsx", "w") as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado")
