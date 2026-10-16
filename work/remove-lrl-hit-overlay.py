from pathlib import Path
p=Path('js/game.js');s=p.read_text(encoding='utf-8');s=s.replace('              this.fx.noteHit(b.x, b.y);', "              if (b.nativeKey !== 'lrl' && b.nativeKey !== 'lrl-axe') this.fx.noteHit(b.x, b.y);");p.write_text(s,encoding='utf-8')
