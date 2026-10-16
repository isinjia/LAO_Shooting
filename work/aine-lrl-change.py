from pathlib import Path
import shutil,json,hashlib
src=Path(r'E:\LAO\Google_QA\Assets\AssetBundleResourceSub\FX\Texture\Shirayuri_NS2_arrow2.png')
dst=Path('assets/native-shots/lrl-arrow.png');shutil.copyfile(src,dst)
Path('assets/native-shots/lrl-arrow-source.json').write_text(json.dumps({'source':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'processing':'Original RGBA copied unchanged; Ain-style arrow silhouette for LRL main shot'},ensure_ascii=False,indent=2),encoding='utf-8')
p=Path('js/native-weapon-fx.js');s=p.read_text(encoding='utf-8').replace("'lrl-axe', 'lrl-flight'", "'lrl-axe', 'lrl-arrow', 'lrl-flight'")
s=s.replace("  if (b.nativeKey === 'lrl-axe')", "  if (b.nativeKey === 'lrl-arrow') {\n    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));\n    ctx.drawImage(entry.image, -15 - b.powerLevel * 1.5, -3.5, 30 + b.powerLevel * 3, 7);\n    ctx.restore(); return true;\n  }\n  if (b.nativeKey === 'lrl-axe')",1)
p.write_text(s,encoding='utf-8')
p=Path('js/basic-shot-patterns.js');s=p.read_text(encoding='utf-8')
a=s.index("    case 'axe':");z=s.index("    case 'baton':",a)
s=s[:a]+'''    case 'axe': {
      // Aine reference: narrow straight main arrow, then a sword wave as subshot.
      spawn({ x: player.x + 36, y: player.y,
        vx: spd * (1.1 + lv * 0.02), vy: 0,
        r: 3.8 + lv * 0.28, damage: dmg * focus * (1 + lv * 0.07),
        pierce: false, lifetime: 2.25, style: 'arrow',
        nativeKey: 'lrl-arrow' });
      if (lv >= 2) {
        spawn({ x: player.x + 25, y: player.y,
          vx: spd * (0.78 + lv * 0.035), vy: 0,
          r: 8 + lv * 2.2, damage: dmg * focus * (0.46 + lv * 0.07),
          pierce: lv >= 3, lifetime: 2.5, style: 'cleave',
          nativeKey: 'lrl' });
      }
      break;
    }
''' +s[z:];p.write_text(s,encoding='utf-8')
p=Path('js/weapon-skills.js');s=p.read_text(encoding='utf-8')
a=s.index("    case 'lrl': {");z=s.index("    case 'merlin': {",a)
s=s[:a]+'''    case 'lrl': {
      // One heavy axe thrown straight forward. No return path or homing.
      const spd = speed * (1.1 + lv * 0.05);
      spawn({
        x: player.x + 42, y: player.y,
        vx: spd, vy: 0,
        r: 17 + lv * 4.2, damage: damage * (1.15 + lv * 0.06),
        pierce: true, blastRadius: 13 + lv * 6,
        lifetime: 2.7,
        style: 'dragonaxe', nativeKey: 'lrl-axe', powerLevel: lv,
      });
      break;
    }
''' +s[z:];p.write_text(s,encoding='utf-8')
