from pathlib import Path
p=Path('work/check-lrl-volley-game.mjs');s=p.read_text();s=s.replace("await p.click('#btn-start');", "await p.waitForFunction(() => typeof document.querySelector('#btn-start')?.onclick === 'function');\nawait p.click('#btn-start');");p.write_text(s)
