with open("src/app/login/page.tsx", "r") as f:
    content = f.read()

# Substituir o SVG do logo no lado esquerdo pelo img real
old_logo_left = '''          <div className="lr-logo">
            <svg className="lr-logo-icon" viewBox="0 0 100 100" fill="none">
              <path d="M50 15 L75 30 L75 65 L50 80 L25 65 L25 30 Z" stroke="#444" strokeWidth="4" fill="none"/>
              <path d="M25 30 L50 45 L75 30" stroke="#444" strokeWidth="3" fill="none"/>
              <path d="M50 45 L50 80" stroke="#444" strokeWidth="3" fill="none"/>
              <circle cx="27" cy="30" r="9" fill="#E53935" stroke="none"/>
              <circle cx="27" cy="30" r="4" fill="white"/>
              <circle cx="73" cy="30" r="9" fill="#FFC107" stroke="none"/>
              <circle cx="73" cy="30" r="4" fill="white"/>
              <circle cx="50" cy="78" r="9" fill="#29B6F6" stroke="none"/>
              <circle cx="50" cy="78" r="4" fill="white"/>
              <path d="M27 30 Q27 15 50 15 Q73 15 73 30" stroke="#FFC107" strokeWidth="5" fill="none" strokeLinecap="round"/>
              <path d="M27 30 L27 65 Q27 80 50 78" stroke="#E53935" strokeWidth="5" fill="none" strokeLinecap="round"/>
              <path d="M73 30 L73 65 Q73 80 50 78" stroke="#29B6F6" strokeWidth="5" fill="none" strokeLinecap="round"/>
            </svg>
            <span className="lr-logo-name">Machine</span>
          </div>'''

new_logo_left = '''          <div className="lr-logo">
            <img src="/machine-logo.png" alt="Machine" className="lr-logo-icon" style={{filter: "brightness(0) invert(1)"}} />
            <span className="lr-logo-name">Machine</span>
          </div>'''

content = content.replace(old_logo_left, new_logo_left)

# Substituir o SVG do logo no lado direito (mobile) pelo img real
old_logo_right = '''          <div className="lr-form-logo">
            <svg style={{width:32,height:32}} viewBox="0 0 100 100" fill="none">
              <circle cx="27" cy="30" r="9" fill="#E53935"/>
              <circle cx="27" cy="30" r="4" fill="white"/>
              <circle cx="73" cy="30" r="9" fill="#FFC107"/>
              <circle cx="73" cy="30" r="4" fill="white"/>
              <circle cx="50" cy="78" r="9" fill="#29B6F6"/>
              <circle cx="50" cy="78" r="4" fill="white"/>
              <path d="M27 30 Q27 15 50 15 Q73 15 73 30" stroke="#FFC107" strokeWidth="5" fill="none" strokeLinecap="round"/>
              <path d="M27 30 L27 65 Q27 80 50 78" stroke="#E53935" strokeWidth="5" fill="none" strokeLinecap="round"/>
              <path d="M73 30 L73 65 Q73 80 50 78" stroke="#29B6F6" strokeWidth="5" fill="none" strokeLinecap="round"/>
            </svg>
            <span style={{fontSize:16,fontWeight:700,color:"#111"}}>Machine</span>
          </div>'''

new_logo_right = '''          <div className="lr-form-logo">
            <img src="/machine-logo.png" alt="Machine" style={{width:32,height:32,objectFit:"contain"}} />
            <span style={{fontSize:16,fontWeight:700,color:"#111"}}>Machine</span>
          </div>'''

content = content.replace(old_logo_right, new_logo_right)

# Remover os stats
old_stats = '''          <div className="lr-stats">
            <div>
              <div className="lr-stat-dot" style={{background:"#E53935"}}/>
              <div className="lr-stat-value">1.2k+</div>
              <div className="lr-stat-label">Parceiros</div>
            </div>
            <div>
              <div className="lr-stat-dot" style={{background:"#FFC107"}}/>
              <div className="lr-stat-value">4</div>
              <div className="lr-stat-label">CSMs ativos</div>
            </div>
            <div>
              <div className="lr-stat-dot" style={{background:"#29B6F6"}}/>
              <div className="lr-stat-value">100%</div>
              <div className="lr-stat-label">Foco em sucesso</div>
            </div>
          </div>'''

new_stats = '''          <p style={{fontSize:12,color:"rgba(255,255,255,0.2)",position:"relative",zIndex:2}}>
            © {new Date().getFullYear()} Machine · Acesso restrito
          </p>'''

content = content.replace(old_stats, new_stats)

with open("src/app/login/page.tsx", "w") as f:
    f.write(content)
print("Atualizado!")
