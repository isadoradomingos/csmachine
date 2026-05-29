with open('src/app/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

old = '''    const { data } = await supabase
      .from("client_audit")
      .select("*, profiles:user_id(full_name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false });
    setAudit(data ?? []);'''

new = '''    const { data } = await supabase
      .from("client_audit")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((d: any) => d.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const profileMap = Object.fromEntries((profilesData ?? []).map((p: any) => [p.id, p]));
      setAudit(data.map((d: any) => ({ ...d, profiles: profileMap[d.user_id] ?? null })));
    } else {
      setAudit([]);
    }'''

if old in content:
    content = content.replace(old, new)
    with open('src/app/clients/[id]/page.tsx', 'w') as f:
        f.write(content)
    print("Corrigido!")
else:
    print("Trecho não encontrado!")
