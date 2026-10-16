from pathlib import Path
p=Path('js/i18n.js');s=p.read_text(encoding='utf-8')
for old,new in [('サイクロプス永遠の光線','闇の斧・幻影突撃'),('Cyclops Eternal Beam','Dark Axe · Phantom Rush'),('獨眼巨人永恆光線','黑暗之斧・幻影突進'),('独眼巨人永恒光线','黑暗之斧·幻影突进'),('Raio Eterno do Cíclope','Machado Sombrio · Investida Fantasma'),('Rayo eterno del Cíclope','Hacha Oscura · Carga Fantasma'),('Вечный луч Циклопа','Тёмный топор · Призрачный рывок')]:s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
