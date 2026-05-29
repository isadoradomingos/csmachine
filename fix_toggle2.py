with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

old_toggle = '''className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${diagnostico[f.id] ? "bg-blue-500" : "bg-gray-200"}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${diagnostico[f.id] ? "translate-x-6" : "translate-x-1"}`} />'''

new_toggle = '''className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${diagnostico[f.id] ? "bg-blue-500" : "bg-gray-200"}`}
                        >
                          <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${diagnostico[f.id] ? "translate-x-5" : "translate-x-0"}`} />'''

count = content.count(old_toggle)
print(f"Encontrado {count} toggles")
content = content.replace(old_toggle, new_toggle)

with open('src/app/clients/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Atualizado!")
