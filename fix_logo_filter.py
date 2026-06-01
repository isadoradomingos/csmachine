with open("src/app/login/page.tsx", "r") as f:
    content = f.read()

old = '''            <img src="/machine-logo.png" alt="Machine" className="lr-logo-icon" style={{filter: "brightness(0) invert(1)"}} />'''
new = '''            <img src="/machine-logo.png" alt="Machine" className="lr-logo-icon" />'''

if old in content:
    content = content.replace(old, new)
    with open("src/app/login/page.tsx", "w") as f:
        f.write(content)
    print("Corrigido!")
else:
    print("Trecho não encontrado")
