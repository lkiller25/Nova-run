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
        "weather": "storm",
    },
    # ---- mondes animés ----
    "grandline": {
        "sky": ["#04101f", "#072a4a", "#0e5a7a", "#1f9fb8"],
        "accent": "#ffd24a", "accent2": "#ff5d5d", "glow": "#fff0b0",
        "far": "#0a2a40", "mid": "#072033", "near": "#03101c",
        "ground": "#061a28", "groundTop": "#ffd24a", "deco": "#0d3a52",
        "sun": "#fff3c0", "star": False, "ambient": "#3fd0e0", "ui": "#ffd24a",
        "weather": "rain", "skyline": "sea",
    },
    "lugnica": {
        "sky": ["#0b0820", "#1d1440", "#3a2a6b", "#7a6ab0"],
        "accent": "#c9b8ff", "accent2": "#8fd8ff", "glow": "#f0eaff",
        "far": "#1a1238", "mid": "#120c28", "near": "#08051a",
        "ground": "#100a26", "groundTop": "#c9b8ff", "deco": "#2a1f52",
        "sun": "#f2f0ff", "star": True, "ambient": "#a898ff", "ui": "#c9b8ff",
        "weather": "snow", "skyline": "castle",
    },
    "tournoi": {
        "sky": ["#12040a", "#2e0a1c", "#6b1430", "#d05a2a"],
        "accent": "#ff7a3d", "accent2": "#ffd24a", "glow": "#ffe0b0",
        "far": "#33101e", "mid": "#220a14", "near": "#120408",
        "ground": "#1c0710", "groundTop": "#ff7a3d", "deco": "#4a1626",
        "sun": "#ffe8c0", "star": True, "ambient": "#ff8a5a", "ui": "#ff9a5d",
        "weather": "storm", "skyline": "torii",
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

# ============================================================ N6 — GRAND LINE (One Piece : mer, radeaux, mâts)
l = Lvl("Grand Line", "La mer des pirates : le trésor t'attend au bout des vagues.", 172, 115, THEMES["grandline"],
        ["Les radeaux mobiles ont un rythme : lis-le avant de sauter",
         "Les mâts se grimpent en sautant de mur en mur",
         "Dash en l'air pour franchir les grandes vagues"])
l.start = (3, 15)
l.ground(0, 12); l.ground(20, 38); l.ground(46, 58); l.ground(66, 84); l.ground(92, 110)
l.ground(118, 126); l.ground(142, 171)
l.box(-1, 0, 1, 15); l.box(172, 0, 2, 15)
# plage de départ
l.coin_row(4, 7, 13); l.walker(9, 15)
l.coin_arc(13, 4, 13.2, 1.4)
# premier rivage
l.checkpoint(22); l.coin_row(21, 24, 13); l.walker(26, 15)
l.spike(30, 14, 2); l.coin_row(30, 31, 11.8); l.hopper(35, 15)
# radeau mobile
l.mover(39, 13, 3, "x", 4, 80); l.coin_arc(39, 5, 11.6, 1.7)
# mâts (puits de wall-jump)
l.box(47, 6, 1, 7); l.box(53, 6, 1, 7)
l.plat(48, 11, 2); l.plat(51, 9, 2)
l.coin_row(48, 52, 12); l.coin(50, 9.5); l.gem(50, 6.4)
l.plat(54, 6, 3); l.plat(57, 9, 3); l.plat(61, 11, 3)
l.coin_row(54, 56, 4.8); l.coin_row(57, 58, 7.8); l.coin_row(61, 62, 9.8)
l.checkpoint(56)
# deuxième rivage
l.coin_row(67, 70, 13); l.checkpoint(70); l.walker(72, 15)
l.spike(76, 14, 3); l.coin_row(76, 78, 11.8); l.hopper(81, 15)
# éboulis au-dessus des vagues
l.crumble(85, 12, 2); l.crumble(88, 10, 2)
l.coin(85, 10.8); l.coin(86, 10.8); l.coin(88, 8.8); l.coin(89, 8.8); l.gem(89, 7.2)
# grande plage : ressort-canon
l.spring(94); l.plat(96, 8, 4); l.coin_row(96, 99, 6.8); l.gem(98, 5.6)
l.flyer(103, 9, 3, 1.3); l.walker(106, 15); l.coin_row(103, 106, 13); l.checkpoint(104)
# ascenseur de fortune
l.mover(111, 13, 3, "y", 4, 75); l.coin_arc(111, 4, 10.8, 1.6)
# îlot de ralliement
l.coin_row(119, 122, 13); l.checkpoint(122); l.walker(120, 15)
# nuages friables
l.crumble(127, 12, 2); l.crumble(130, 10, 2)
l.coin(127, 10.8); l.coin(128, 10.8); l.coin(130, 8.8); l.coin(131, 8.8); l.gem(130, 7.0)
# radeau mobile
l.mover(135, 13, 3, "x", 4, 90); l.coin_arc(135, 5, 11.6, 1.7)
# île au trésor
l.coin_row(143, 146, 13)
l.plat(150, 12, 3); l.plat(154, 10, 3); l.plat(158, 12, 3)
l.coin_row(150, 151, 10.8); l.coin_row(154, 155, 8.8); l.coin_row(158, 159, 10.8)
l.gem(155, 7.4)
l.flyer(150, 8, 4, 1.5); l.walker(148, 15); l.hopper(160, 15)
l.spike(164, 14, 2); l.coin_row(164, 165, 11.8)
l.the_goal(168, 15)
levels.append(l)

# ============================================================ N7 — LUGNICA (Re:Zero : neige, ruines, blizzard)
l = Lvl("Lugnica Enneigée", "Le royaume de glace veille sous une neige éternelle.", 178, 125, THEMES["lugnica"],
        ["La neige cache les dalles fragiles",
         "Enchaîne les sauts de mur dans les ruines",
         "Les plateformes mobiles traversent le blizzard"])
l.start = (3, 15)
l.ground(0, 11); l.ground(19, 34); l.ground(42, 56); l.ground(64, 80); l.ground(88, 106)
l.ground(114, 132); l.ground(140, 158); l.ground(166, 177)
l.box(-1, 0, 1, 15); l.box(178, 0, 2, 15)
# plaine enneigée
l.coin_row(4, 7, 13); l.walker(9, 15)
l.coin_arc(12, 4, 13.2, 1.4)
# village
l.checkpoint(21); l.coin_row(20, 23, 13); l.hopper(25, 15)
l.spike(29, 14, 2); l.coin_row(29, 30, 11.8); l.walker(32, 15)
# glaçons flottants
l.crumble(35, 12, 2); l.crumble(38, 10, 2)
l.coin(35, 10.8); l.coin(36, 10.8); l.coin(38, 8.8); l.coin(39, 8.8); l.gem(38, 7.2)
# ruines : puits à wall-jump
l.box(43, 6, 1, 7); l.box(49, 6, 1, 7)
l.plat(44, 11, 2); l.plat(47, 9, 2)
l.coin_row(44, 48, 12); l.coin(46, 9.5); l.gem(46, 6.4)
l.plat(50, 6, 3); l.plat(53, 9, 3)
l.coin_row(50, 52, 4.8); l.coin_row(53, 54, 7.8); l.checkpoint(54)
# traversée en traîneau
l.mover(57, 13, 3, "x", 4, 100); l.coin_arc(57, 5, 11.6, 1.7)
# place du sanctuaire : ressort
l.coin_row(65, 68, 13); l.checkpoint(68); l.spring(70); l.plat(72, 7, 4)
l.coin_row(72, 75, 5.8); l.gem(74, 4.6)
l.flyer(77, 9, 3, 1.2); l.walker(78, 15)
# corniches enneigées
l.plat(82, 12, 2); l.plat(85, 10, 2)
l.coin_row(82, 83, 10.8); l.coin_row(85, 86, 8.8)
# forêt givrée
l.coin_row(89, 92, 13); l.checkpoint(90); l.walker(94, 15)
l.spike(98, 14, 2); l.coin_row(98, 99, 11.8); l.hopper(102, 15)
# plateforme mobile
l.mover(107, 13, 3, "x", 4, 90); l.coin_arc(107, 5, 11.6, 1.7)
# plateau des chevaliers
l.coin_row(115, 118, 13); l.walker(120, 15); l.checkpoint(122); l.hopper(124, 15)
l.spike(127, 14, 3); l.coin_row(127, 129, 11.8)
# escalier de glace friable
l.crumble(133, 12, 2); l.crumble(136, 10, 2)
l.coin(133, 10.8); l.coin(134, 10.8); l.coin(136, 8.8); l.coin(137, 8.8)
# dernière place
l.coin_row(141, 144, 13); l.walker(146, 15); l.flyer(149, 8, 4, 1.4)
l.plat(150, 11, 3); l.plat(154, 9, 3)
l.coin_row(150, 151, 9.8); l.coin_row(154, 155, 7.8); l.gem(155, 6.4)
l.checkpoint(152); l.hopper(156, 15)
# dernier saut
l.coin_arc(159, 4, 12.4, 1.4); l.plat(162, 11, 2); l.coin_row(162, 163, 9.8)
# ligne d'arrivée
l.coin_row(167, 170, 13); l.walker(171, 15)
l.the_goal(174, 15)
levels.append(l)

# ============================================================ N8 — TOURNOI DES HÉROS (final crossover, tempête)
l = Lvl("Tournoi des Héros", "L'arène ultime : toutes les techniques, un seul vainqueur.", 188, 140, THEMES["tournoi"],
        ["Tout est réuni : murs, ressorts, mobiles et dalles friables",
         "Garde ton calme dans la tempête",
         "Le portail t'attend au bout de l'arène"])
l.start = (3, 15)
l.ground(0, 10); l.ground(18, 34); l.ground(42, 54); l.ground(62, 78); l.ground(86, 102)
l.ground(110, 116); l.ground(129, 154); l.ground(162, 187)
l.box(-1, 0, 1, 15); l.box(188, 0, 2, 15)
# entrée de l'arène
l.coin_row(3, 6, 13); l.flyer(8, 9, 3, 1.4)
l.coin_arc(11, 4, 13.2, 1.4)
# tour d'escalade (wall jump)
l.box(20, 4, 1, 8); l.box(26, 4, 1, 8)
l.plat(21, 10, 2); l.plat(24, 8, 2)
l.coin_row(21, 25, 11); l.coin(23, 8.5); l.gem(23, 5.4)
l.plat(27, 4, 3); l.plat(30, 7, 3)
l.coin_row(27, 29, 3.8); l.coin_row(30, 31, 6.8); l.checkpoint(31); l.walker(33, 15)
# passerelle mobile
l.mover(35, 13, 3, "x", 4, 110); l.coin_arc(35, 5, 11.6, 1.7)
# ring des piques
l.coin_row(43, 46, 13); l.checkpoint(45); l.spike(48, 14, 3); l.coin_row(48, 50, 11.8); l.hopper(52, 15)
# nuages de combat
l.crumble(55, 12, 2); l.crumble(58, 10, 2)
l.coin(55, 10.8); l.coin(56, 10.8); l.coin(58, 8.8); l.coin(59, 8.8)
# ressort du champion
l.spring(64); l.plat(66, 8, 4); l.coin_row(66, 69, 6.8); l.gem(68, 5.8)
l.plat(70, 11, 3); l.plat(74, 9, 3); l.coin_row(70, 71, 9.8); l.coin_row(74, 75, 7.8)
l.flyer(72, 8, 3, 1.5); l.checkpoint(70); l.walker(76, 15)
# ascenseur vertical
l.mover(79, 13, 3, "y", 4, 75); l.coin_arc(79, 4, 10.8, 1.6)
# seconde arène
l.coin_row(87, 90, 13); l.walker(92, 15); l.checkpoint(94); l.spike(96, 14, 2)
l.coin_row(96, 97, 11.8); l.hopper(100, 15)
# corniches
l.plat(103, 12, 2); l.plat(106, 10, 2); l.coin_row(103, 104, 10.8); l.coin_row(106, 107, 8.8)
# îlot
l.coin_row(111, 114, 13); l.checkpoint(112); l.walker(113, 15)
# grand pont friable
l.crumble(117, 12, 2); l.crumble(120, 10, 2); l.crumble(123, 12, 2); l.crumble(126, 10, 2)
l.coin(117, 10.8); l.coin(118, 10.8); l.coin(120, 8.8); l.coin(121, 8.8)
l.coin(123, 10.8); l.coin(124, 10.8); l.coin(126, 8.8); l.coin(127, 8.8); l.gem(121, 7.0)
# reprise
l.coin_row(130, 133, 13); l.hopper(136, 15); l.spike(140, 14, 3); l.coin_row(140, 142, 11.8)
l.plat(144, 11, 3); l.plat(148, 9, 3); l.coin_row(144, 145, 9.8); l.coin_row(148, 149, 7.8); l.gem(149, 6.4)
l.flyer(145, 9, 4, 1.6); l.walker(148, 15); l.checkpoint(151)
# radeau des cimes
l.mover(155, 13, 3, "x", 4, 100); l.coin_arc(155, 5, 11.6, 1.7)
# dernière ligne droite
l.coin_row(163, 166, 13); l.plat(168, 12, 3); l.plat(172, 10, 3)
l.coin_row(168, 169, 10.8); l.coin_row(172, 173, 8.8)
l.hopper(170, 15); l.walker(176, 15); l.spike(179, 14, 2)
l.the_goal(183, 15)
levels.append(l)

# ============================================================ EXPORT
# le dépôt existe aussi en version aplatie (fichiers à la racine) : on écrit
# dans src/ s'il existe, sinon à la racine
OUT_DIR = "src" if os.path.isdir("src") else "."
MAPS_PATH = os.path.join("tools", "maps.txt") if os.path.isdir("tools") else "maps.txt"
out = "const LEVELS = " + json.dumps([lv.to_dict(i) for i, lv in enumerate(levels)], ensure_ascii=False) + ";\n"
os.makedirs(OUT_DIR, exist_ok=True)
with open(os.path.join(OUT_DIR, "levels.js"), "w", encoding="utf-8") as f:
    f.write("/* NOVA RUN — niveaux générés par tools/gen_levels.py */\n" + out)

with open(MAPS_PATH, "w", encoding="utf-8") as f:
    for i, lv in enumerate(levels):
        f.write("\n=== N%d %s (%d tuiles) ===\n" % (i + 1, lv.name, lv.width_tiles))
        f.write(lv.ascii() + "\n")

print("niveaux:", len(levels))
for i, lv in enumerate(levels):
    d = lv.to_dict(i)
    print("  N%d %-20s width=%5d coins=%3d gems=%d enemies=%2d plats=%2d crumbles=%d movers=%d"
          % (i + 1, lv.name, d["width"], len(d["coins"]), len(d["gems"]), len(d["enemies"]),
             len(d["plats"]), len(d["crumbles"]), len(d["movers"])))
