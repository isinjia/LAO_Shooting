from pathlib import Path
p=Path('js/bullet.js');s=p.read_text(encoding='utf-8');needle='      const speed = this.returnSpeed || Math.hypot(this.vx, this.vy);';s=s.replace(needle,needle+"\n      if (this.style === 'dragonaxe' && length <= Math.max(16, speed * dt)) {\n        this.alive = false;\n        return;\n      }",1);p.write_text(s,encoding='utf-8')
p=Path('work/check-lrl-game.mjs');s=p.read_text().replace('g.player.shoot(g.bullets)','g.player.fireCharge(g.bullets)').replace('native-game-lrl.png','lrl-charge-axe-game.png');Path('work/check-lrl-axe-game.mjs').write_text(s)
