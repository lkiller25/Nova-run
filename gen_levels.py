#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère src/levels.js (niveaux de NOVA RUN) + une carte ASCII de contrôle.
Repères : tuiles de 40px, monde de 18 rangées (720px), sol = rangée 15.
Portée des sauts : saut simple ~143px de haut / ~230px de long,
double saut ~254px de haut, ressort ~363px, dash ~+120px de portée.
"""
import json, os

T = 40
ROWS = 18

class Lvl:
    def __init__(self, name, subtitle, width, par, theme, hints):
        self.name, self.subtitle = name, subtitle
        self.width_tiles, self.par = width, par
        self.theme, self.hints = theme, hints
        self.solids, self.plats, self.spikes = [], [], []
        self.coins, self.gems, self.enemies = [], [], []
        self.springs, self.crumbles, self.movers = [], [], []
        self.checkpoints, self.goal = [], None
        self.start = (3, 15)

    def ground(self, x0, x1, row=15):
        self.solids.append([x0 * T, row * T, (x1 - x0 + 1) * T, (ROWS - row) * T])

    def box(self, x, y, w, h):
        self.solids.append([x * T, y * T, w * T, h * T])

    def plat(self, x, y, w):
        self.plats.append([x * T, y * T, w * T])

    def spike(self, x, y, w):
        self.spikes.append([x * T, y * T + 16, w * T, 24])

    def coin(self, x, y):
        self.coins.append([round(x * T + 20), round(y * T + 20)])

    def coin_row(self, x0, x1, y):
        for x in range(x0, x1 + 1):
            self.coin(x, y)

    def coin_arc(self, x0, n, y, lift=1.4):
        for i in range(n):
            t = i / max(1, n - 1)
            self.coin(x0 + i, y - lift * (1 - (2 * t - 1) ** 2))

    def gem(self, x, y):
        self.gems.append([round(x * T + 20), round(y * T + 20)])

    def walker(self, x, y):
        self.enemies.append({"t": "walker", "x": x * T + 3, "y": y * T, "w": 34, "h": 30})

    def hopper(self, x, y):
        self.enemies.append({"t": "hopper", "x": x * T + 2, "y": y * T, "w": 36, "h": 33})

    def flyer(self, x, y, amp=3, speed=1.1):
        self.enemies.append({"t": "flyer", "x": x * T, "y": y * T + 20,
                             "w": 34, "h": 34, "amp": amp * T, "speed": speed})

    def spring(self, x, row=15):
        self.springs.append([x * T + 2, row * T - 15, 36, 15])

    def crumble(self, x, y, w):
        self.crumbles.append([x * T, y * T, w * T])

    def mover(self, x, y, w, axis, dist, speed, phase=0):
        self.movers.append([x * T, y * T, w * T, axis, dist * T, speed, phase])

    def checkpoint(self, x, row=15):
        self.checkpoints.append([x * T + 20, row * T])

    def the_goal(self, x, row=15):
        self.goal = [x * T + 20, row * T]

    def to_dict(self, i):
        sx, sy = self.start
        return {
            "id": i, "name": self.name, "subtitle": self.subtitle,
            "width": self.width_tiles * T, "par": self.par, "theme": self.theme,
            "hints": self.hints, "start": [sx * T, sy * T],
            "solids": self.solids, "plats": self.plats, "spikes": self.spikes,
            "coins": self.coins, "gems": self.gems, "enemies": self.enemies,
            "springs": self.springs, "crumbles": self.crumbles, "movers": self.movers,
            "checkpoints": self.checkpoints, "goal": self.goal,
        }

    def ascii(self):
        g = [[" "] * self.width_tiles for _ in range(ROWS)]
        put = lambda x, y, c: g[max(0, min(ROWS - 1, y))].__setitem__(max(0, min(self.width_tiles - 1, x)), c)
        for (x, y, w, h) in self.solids:
            for yy in range(int(y / T), int((y + h) / T)):
                for xx in range(int(x / T), int((x + w) / T)):
                    put(xx, yy, "#")
        for (x, y, w) in self.plats:
            for xx in range(int(x / T), int((x + w) / T)): put(xx, int(y / T), "=")
        for (x, y, w) in self.crumbles:
            for xx in range(int(x / T), int((x + w) / T)): put(xx, int(y / T), "C")
        for (x, y, w, h) in self.spikes:
            for xx in range(int(x / T), int((x + w) / T)): put(xx, int((y - 16) / T), "^")
        for (x, y) in self.coins: put(int(x / T), int(y / T), "o")
        for (x, y) in self.gems: put(int(x / T), int(y / T), "*")
        for e in self.enemies:
            put(int(e["x"] / T), int(e["y"] / T), {"walker": "w", "hopper": "h", "flyer": "f"}[e["t"]])
        for (x, y, w, a, d, sp, ph) in self.movers: put(int(x / T), int(y / T), "M")
        for (x, y, w, h) in self.springs: put(int(x / T), int((y + h) / T) - 1, "S")
        for (x, y) in self.checkpoints: put(int(x / T), int(y / T) - 1, "P")
        if self.goal: put(int(self.goal[0] / T), int(self.goal[1] / T) - 1, "G")
        return "\n".join("".join(r) for r in g)


THEMES = {
    "aube": {
        "sky": ["#1b1038", "#5b2a63", "#e0765a", "#ffc178"],
        "accent": "#ffb26b", "accent2": "#ff5d8f", "glow": "#ffd6a0",
        "far": "#3a2350", "mid": "#2a1740", "near": "#150b22",
        "ground": "#1d1030", "groundTop": "#ffb26b", "deco": "#7a4a86",
        "sun": "#ffe3b0", "star": True, "ambient": "#ff9e6b", "ui": "#ffb26b",
    },
    "foret": {
        "sky": ["#04121a", "#062a33", "#0a4a48", "#127a63"],
        "accent": "#3dffc0", "accent2": "#7bff5d", "glow": "#b8ffe8",
        "far": "#0a2a2e", "mid": "#07201f", "near": "#03100f",
        "ground": "#061a17", "groundTop": "#3dffc0", "deco": "#0d3a35",
        "sun": "#d6fff2", "star": True, "ambient": "#26e0a0", "ui": "#3dffc0",
    },
    "canyon": {
        "sky": ["#170619", "#3b0d2e", "#8b1e3f", "#e0563c"],
        "accent": "#ff8a3d", "accent2": "#ff3d6e", "glow": "#ffd0a0",
        "far": "#4a1430", "mid": "#2e0b22", "near": "#180614",
        "ground": "#22071c", "groundTop": "#ff8a3d", "deco": "#5c1a3a",
        "sun": "#ffd9a0", "star": False, "ambient": "#ff7a4a", "ui": "#ff8a3d",
    },
    "glace": {
        "sky": ["#04081f", "#0a1a44", "#123a6b", "#2f8fbf"],
        "accent": "#5cd8ff", "accent2": "#a08cff", "glow": "#d8f6ff",
        "far": "#0d2150", "mid": "#081634", "near": "#040a1d",
        "ground": "#081428", "groundTop": "#5cd8ff", "deco": "#123a63",
        "sun": "#e8f8ff", "star": True, "ambient": "#5cd8ff", "ui": "#7fe4ff",
    },
    "orage": {
        "sky": ["#0a0414", "#1e0830", "#3d0f4e", "#7a1a5e"],
        "accent": "#ff5ce1", "accent2": "#7c5cff", "glow": "#ffd0f8",
        "far": "#2a0f3d", "mid": "#1b0829", "near": "#0d0417",
        "ground": "#160722", "groundTop": "#ff5ce1", "deco": "#43165c",
        "sun": "#ffd9f4", "star": True, "ambient": "#e05cff", "ui": "#ff5ce1",
    },
}

levels = []

# ============================================================ N1 — AUBE (tutoriel)
l = Lvl("Brise Matinale", "Les toits dorment encore. Réveille-les.", 126, 55, THEMES["aube"],
        ["ZQSD / Flèches : courir", "Espace : sauter — appuie 2× pour un double saut", "Maj : dash (en l'air aussi)"])
l.start = (3, 15)
l.ground(0, 24); l.ground(28, 45); l.ground(50, 58); l.ground(75, 93); l.ground(109, 125)
l.box(-1, 0, 1, 15); l.box(126, 0, 2, 15)
l.coin_arc(25, 3, 13.2, 1.3)
l.coin_arc(46, 4, 13.2, 1.5)
l.plat(60, 12, 3); l.plat(65, 10, 3); l.plat(70, 12, 3)
l.coin_row(60, 61, 10.8); l.coin_row(65, 66, 8.8); l.coin_row(70, 71, 10.8)
l.gem(66, 6.9)
l.coin_row(77, 80, 13)
l.spike(84, 14, 2)
l.coin_row(84, 85, 11.8)
l.walker(35, 15); l.walker(41, 15); l.walker(76, 15); l.walker(90, 15)
l.checkpoint(87)
l.crumble(95, 12, 3); l.plat(99, 11, 3); l.plat(103, 12, 3)
l.coin_row(95, 96, 10.8); l.coin_row(99, 100, 9.8); l.coin_row(103, 104, 10.8)
l.coin_row(96, 97, 8.6)
l.coin_row(112, 115, 13)
l.gem(115, 10.5)
l.walker(118, 15)
l.the_goal(121, 15)
levels.append(l)

# ============================================================ N2 — FORÊT (wall jump)
l = Lvl("Forêt de Néon", "La sève lumineuse ne pardonne pas les faux pas.", 142, 70, THEMES["foret"],
        ["Saute contre un mur, puis saute encore : tu grimpes", "Le double saut sauve des vies", "BAS en l'air : chute rapide"])
l.start = (3, 15)
l.ground(0, 18); l.ground(24, 44); l.ground(45, 51); l.ground(64, 80)
l.ground(97, 127); l.ground(129, 141)
l.box(-1, 0, 1, 15); l.box(142, 0, 2, 15)
l.plat(20, 13, 2)
l.coin_arc(19, 5, 13.4, 1.6)
l.flyer(11, 9, 3, 1.0)
l.walker(28, 15); l.spike(34, 14, 2); l.hopper(39, 15)
l.checkpoint(31)
# --- puits à wall-jump (murs cols 45 et 51, rangées 6..12) + échelle de secours
l.box(45, 6, 1, 7); l.box(51, 6, 1, 7)
l.plat(46, 11, 2); l.plat(49, 9, 2)
l.coin_row(46, 50, 12); l.coin(46, 9.5); l.coin(50, 9.5)
l.gem(48, 6.4)
l.plat(52, 6, 4)
l.plat(57, 9, 3); l.plat(61, 11, 3)
l.coin_row(52, 55, 4.8); l.coin_row(57, 58, 7.8); l.coin_row(61, 62, 9.8)
l.checkpoint(68)
l.walker(72, 15); l.hopper(77, 15)
l.coin_row(66, 69, 13)
l.plat(83, 12, 3); l.plat(88, 10, 3); l.plat(93, 12, 3)
l.coin_row(83, 84, 10.8); l.coin_row(88, 89, 8.8); l.coin_row(93, 94, 10.8)
l.gem(89, 7.4)
l.checkpoint(108)
l.flyer(101, 9, 4, 1.2)
l.spike(105, 14, 2)
l.coin_arc(105, 2, 12.4, 1.0)
l.plat(114, 13, 3); l.plat(118, 11, 3); l.plat(122, 9, 3)
l.coin_row(114, 115, 11.8); l.coin_row(118, 119, 9.8); l.coin_row(122, 123, 7.8)
l.gem(123, 7.2)
l.coin_row(125, 128, 13)
l.plat(131, 11, 3)
l.coin_row(131, 132, 9.8)
l.hopper(132, 15); l.walker(139, 15)
l.the_goal(136, 15)
levels.append(l)

# ============================================================ N3 — CANYON (ressorts, mobiles, friables)
l = Lvl("Canyons de Verre", "Ressorts, plateformes mobiles et sable qui s'effrite.", 154, 85, THEMES["canyon"],
        ["Les ressorts t'envoient très haut", "Les plateformes claires s'effondrent : ne traîne pas", "Maj en l'air : dash pour franchir les grands gouffres"])
l.start = (3, 15)
l.ground(0, 14); l.ground(30, 47); l.ground(65, 85); l.ground(100, 118); l.ground(133, 153)
l.box(-1, 0, 1, 15); l.box(154, 0, 2, 15)
l.spring(9); l.plat(10, 7, 4)
l.coin_row(10, 13, 5.8); l.gem(12, 4.6)
l.coin_row(4, 7, 13)
l.mover(17, 13, 3, "x", 9, 80)
l.coin_arc(16, 12, 12.2, 2.0)
l.coin_row(31, 34, 13)
l.checkpoint(33)
l.walker(36, 15); l.spike(39, 14, 3); l.hopper(45, 15)
l.coin_row(39, 41, 11.8)
l.crumble(49, 12, 3); l.crumble(54, 11, 3); l.crumble(59, 12, 3)
l.coin_row(49, 50, 10.8); l.coin_row(54, 55, 9.8); l.coin_row(59, 60, 10.8)
l.gem(56, 8.2)
l.coin_row(67, 70, 13)
l.checkpoint(69); l.hopper(73, 15); l.walker(78, 15); l.spike(81, 14, 2)
l.mover(88, 13, 3, "y", 4, 65)
l.mover(93, 10, 3, "x", 5, 80)
l.coin_arc(88, 11, 8.2, 2.4)
l.coin_row(102, 105, 13)
l.checkpoint(107); l.walker(110, 15); l.spike(114, 14, 3)
l.coin_row(114, 116, 11.8)
l.plat(121, 12, 3); l.plat(125, 10, 3); l.plat(129, 12, 3)
l.coin_row(121, 122, 10.8); l.coin_row(125, 126, 8.8); l.coin_row(129, 130, 10.8)
l.gem(126, 7.2)
l.walker(139, 15); l.hopper(144, 15)
l.the_goal(147, 15)
levels.append(l)

# ============================================================ N4 — GLACE (dash, mobiles, friables)
l = Lvl("Glace Électrique", "Un faux pas et tu glisses vers l'infini.", 166, 100, THEMES["glace"],
        ["Les murs de glace sont tes alliés", "Enchaîne saut + dash pour aller plus loin", "Chute rapide : BAS en l'air"])
l.start = (3, 15)
l.ground(0, 12); l.ground(21, 44); l.ground(55, 66)
l.ground(93, 108); l.ground(128, 144); l.ground(154, 165)
l.box(-1, 0, 1, 15); l.box(166, 0, 2, 15)
l.spike(8, 14, 2)
l.coin_arc(8, 2, 12.2, 1.0)
l.plat(14, 12, 2); l.plat(18, 10, 2)
l.coin_row(14, 14, 10.8); l.coin_row(18, 18, 8.8)
l.gem(18, 7.4)
l.coin_row(23, 26, 13)
l.checkpoint(25); l.walker(28, 15); l.flyer(27, 9, 3, 1.3)
# --- puits à wall-jump
l.box(34, 6, 1, 7); l.box(40, 6, 1, 7)
l.plat(35, 11, 2); l.plat(38, 9, 2)
l.coin_row(35, 39, 12); l.coin(37, 9.5)
l.plat(41, 6, 4)
l.plat(47, 9, 3); l.plat(51, 11, 3)
l.coin_row(41, 44, 4.8); l.coin_row(47, 48, 7.8); l.coin_row(51, 52, 9.8)
l.spike(60, 14, 3); l.coin_row(60, 62, 11.8)
l.hopper(64, 15); l.checkpoint(63)
l.mover(69, 13, 3, "x", 7, 110)
l.mover(82, 10, 3, "y", 3, 80)
l.mover(88, 12, 3, "x", 4, 110)
l.coin_arc(70, 16, 10.4, 2.2)
l.gem(82, 6.4)
l.coin_row(94, 97, 13)
l.checkpoint(96); l.hopper(100, 15); l.walker(104, 15); l.spike(106, 14, 2)
l.crumble(111, 12, 2); l.crumble(114, 10, 2); l.crumble(117, 12, 2)
l.crumble(120, 10, 2); l.crumble(123, 12, 2)
l.coin_row(111, 111, 10.8); l.coin_row(114, 114, 8.8); l.coin_row(117, 117, 10.8)
l.coin_row(120, 120, 8.8); l.coin_row(123, 123, 10.8)
l.gem(121, 6.6)
l.coin_row(129, 132, 13)
l.checkpoint(130); l.walker(135, 15); l.hopper(139, 15); l.spike(141, 14, 3)
l.coin_row(141, 143, 11.8)
l.plat(146, 12, 3); l.plat(150, 10, 3)
l.coin_row(146, 147, 10.8); l.coin_row(150, 151, 8.8)
l.the_goal(159, 15)
levels.append(l)

# ============================================================ N5 — ORAGE (final)
l = Lvl("Cœur de l'Orage", "L'ultime course. Tout ce que tu sais, en une traite.", 182, 120, THEMES["orage"],
        ["Tout est là : murs, ressorts, plateformes, dash", "Les yeux volants ne pardonnent rien", "Le portail t'attend au bout de l'orage"])
l.start = (3, 15)
l.ground(0, 10); l.ground(17, 35); l.ground(50, 58); l.ground(77, 92)
l.ground(114, 126); l.ground(150, 181)
l.box(-1, 0, 1, 15); l.box(182, 0, 2, 15)
l.spike(7, 14, 2)
l.coin_arc(7, 2, 12.2, 1.0)
l.plat(12, 12, 2)
l.flyer(13, 8, 3, 1.5)
l.coin_row(12, 12, 10.8)
l.coin_row(19, 22, 13)
l.walker(23, 15); l.hopper(26, 15); l.checkpoint(21)
# --- puits haut
l.box(29, 4, 1, 8); l.box(35, 4, 1, 8)
l.plat(30, 10, 2); l.plat(33, 8, 2)
l.coin_row(30, 34, 11); l.coin(31, 9.5); l.coin(34, 9.5)
l.gem(31, 5.4)
l.plat(36, 4, 4)
l.plat(42, 7, 3); l.plat(46, 9, 3)
l.coin_row(36, 39, 2.8); l.coin_row(42, 43, 5.8); l.coin_row(46, 47, 7.8)
l.spike(54, 14, 3); l.coin_row(54, 56, 11.8)
l.hopper(57, 15); l.checkpoint(52)
# --- gouffre géant
l.mover(60, 13, 3, "x", 8, 110)
l.mover(71, 11, 3, "y", 4, 75)
l.flyer(70, 6, 5, 1.6)
l.coin_arc(60, 20, 10.6, 2.4)
l.gem(76, 6.4)
l.coin_row(83, 86, 13)
l.checkpoint(85); l.walker(89, 15); l.spike(91, 14, 1)
# --- friables + pics
l.crumble(95, 12, 2); l.crumble(98, 10, 2); l.crumble(101, 12, 2)
l.crumble(104, 10, 2); l.crumble(107, 12, 2); l.crumble(110, 10, 2)
for c in (95, 98, 101, 104, 107, 110):
    l.coin(c, (11 if c in (95, 101, 107) else 9))
l.gem(105, 6.4)
l.coin_row(115, 118, 13)
l.checkpoint(117)
l.spring(120); l.plat(122, 8, 4)
l.coin_row(122, 125, 6.8); l.gem(124, 6.2)
# --- traversée finale
l.plat(129, 13, 3); l.plat(134, 11, 3); l.plat(139, 13, 3); l.plat(145, 11, 3)
l.coin_row(129, 130, 11.8); l.coin_row(134, 135, 9.8); l.coin_row(139, 140, 11.8); l.coin_row(145, 146, 9.8)
l.ground(150, 181)
l.coin_row(153, 156, 13)
l.walker(156, 15); l.flyer(162, 9, 4, 1.4); l.hopper(168, 15)
l.the_goal(175, 15)
levels.append(l)

# ============================================================ EXPORT
out = "const LEVELS = " + json.dumps([lv.to_dict(i) for i, lv in enumerate(levels)], ensure_ascii=False) + ";\n"
os.makedirs("src", exist_ok=True)
with open("src/levels.js", "w", encoding="utf-8") as f:
    f.write("/* NOVA RUN — niveaux générés par tools/gen_levels.py */\n" + out)

with open("tools/maps.txt", "w", encoding="utf-8") as f:
    for i, lv in enumerate(levels):
        f.write("\n=== N%d %s (%d tuiles) ===\n" % (i + 1, lv.name, lv.width_tiles))
        f.write(lv.ascii() + "\n")

print("niveaux:", len(levels))
for i, lv in enumerate(levels):
    d = lv.to_dict(i)
    print("  N%d %-20s width=%5d coins=%3d gems=%d enemies=%2d plats=%2d crumbles=%d movers=%d"
          % (i + 1, lv.name, d["width"], len(d["coins"]), len(d["gems"]), len(d["enemies"]),
             len(d["plats"]), len(d["crumbles"]), len(d["movers"])))
