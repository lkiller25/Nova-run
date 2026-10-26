#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Assemble index.html : un seul fichier autonome, sans dépendance réseau."""
import os, re, datetime

# le dépôt existe en version aplatie (fichiers à la racine) et en version src/
SRC = 'src' if os.path.isdir('src') else '.'
OUT = 'nova-run.html'
OUT_INDEX = 'index.html'   # même fichier, pour que GitHub Pages serve le jeu directement

def read(p):
    with open(os.path.join(SRC, p), encoding='utf-8') as f:
        return f.read()

tpl = read('template.html')
parts = {
    '/*__CSS__*/': read('style.css'),
    '/*__LEVELS__*/': open(os.path.join(SRC, 'levels.js'), encoding='utf-8').read(),
    '/*__AUDIO__*/': read('audio.js'),
    '/*__GAME__*/': read('game.js'),
    '/*__RENDER__*/': read('render.js'),
    '/*__UI__*/': read('ui.js'),
}
for k, v in parts.items():
    if k not in tpl:
        raise SystemExit('placeholder manquant: ' + k)
    tpl = tpl.replace(k, v)

stamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
tpl = tpl.replace('</title>', '</title>\n<!-- NOVA RUN — build %s — fichier autonome, aucune ressource externe -->' % stamp)

for out in (OUT, OUT_INDEX):
    with open(out, 'w', encoding='utf-8') as f:
        f.write(tpl)

kb = os.path.getsize(OUT) / 1024
print('écrit %s et %s (%.0f Ko)' % (OUT, OUT_INDEX, kb))
