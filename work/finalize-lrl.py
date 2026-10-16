from pathlib import Path
p=Path('js/game.js');s=p.read_text(encoding='utf-8');s=s.replace("            this.bullets.nativeEffects?.emit(b, 'impact', e);\n              this.projectileVfx.impact(b);\n            this.audio", "            this.bullets.nativeEffects?.emit(b, 'impact', e);\n            this.projectileVfx.impact(b);\n            this.audio");p.write_text(s,encoding='utf-8')
p=Path('work/check-native-game.mjs');s=p.read_text().replace('merlin','lrl');s=s.replace("g.player.shoot(g.bullets);", "g.player.shoot(g.bullets);");Path('work/check-lrl-game.mjs').write_text(s)
