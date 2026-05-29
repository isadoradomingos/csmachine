with open('src/app/dashboard/page.tsx', 'r') as f:
    content = f.read()

old = """  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(profile);

      const { data: clients } = await supabase
        .from("clients")
        .select("id, marca, bandeira, operacao, plano, cluster, status, last_contact")
        .eq("csm_id", user.id)
        .eq("status", "ativo")
        .order("marca")
        .limit(10000);
      setClients(clients ?? []);
      setLoading(false);
    }
    load();
  }, []);"""

new = """  const [contactCount, setContactCount] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(profile);

      const { data: clients } = await supabase
        .from("clients")
        .select("id, marca, bandeira, operacao, plano, cluster, status, last_contact")
        .eq("csm_id", user.id)
        .eq("status", "ativo")
        .order("marca")
        .limit(10000);
      setClients(clients ?? []);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const { count } = await supabase
        .from("client_contacts")
        .select("id, clients!inner(csm_id)", { count: "exact", head: true })
        .eq("type", "consultoria_produto")
        .eq("clients.csm_id", user.id)
        .gte("date", startOfMonth.toISOString().split("T")[0]);
      setContactCount(count ?? 0);
      setLoading(false);
    }
    load();
  }, []);"""

if old in content:
    content = content.replace(old, new)
    with open('src/app/dashboard/page.tsx', 'w') as f:
        f.write(content)
    print("Atualizado!")
else:
    print("Trecho não encontrado!")
