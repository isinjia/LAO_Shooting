from pathlib import Path
p=Path('js/player.js'); s=p.read_text(encoding='utf8')
s="import { fireRoleBasic } from './basic-shot-patterns.js';\n"+s
a=s.index("      case 'axe': {",s.index('  shoot(bullets)'))
b=s.index("      case 'railgun': {",a)
s=s[:a]+"""      case 'axe':
      case 'baton':
      case 'tesla':
      case 'hmg':
      case 'plasma':
        fireRoleBasic(this, bullets, { lv, dmg, spd, r, base, targets });
        break;
"""+s[b:]
# Their support function is now built into the main attack, not another volley.
pos=s.index('  fireOptions(bullets)')
i=s.index("    const pattern = shot.pattern || 'yatagarasu';",pos)
end=i+len("    const pattern = shot.pattern || 'yatagarasu';")
s=s[:end]+"\n    if (['axe', 'baton', 'tesla', 'hmg', 'plasma'].includes(pattern)) return;"+s[end:]
p.write_text(s,encoding='utf8')
