"""OpenStreetMap 데이터(.osm)를 게임 지도 스타일 이미지로 그리는 도구.

사용법: python3 tools/render_map.py data/jnu.osm public/maps/jnu.png
지도 데이터 © OpenStreetMap 기여자 (ODbL)
"""
import math
import random
import sys
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = sys.argv[1] if len(sys.argv) > 1 else 'data/jnu.osm'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'map.png'
PX_PER_M = 1.0   # 최종 이미지 1픽셀 = 1미터
SS = 2           # 계단 현상 줄이기용 2배로 그린 뒤 축소
FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
random.seed(7)

# ---------- 데이터 읽기 ----------
root = ET.parse(SRC).getroot()
b = root.find('bounds').attrib
minlat, minlon, maxlat, maxlon = (float(b[k]) for k in ('minlat', 'minlon', 'maxlat', 'maxlon'))
lat0 = (minlat + maxlat) / 2
kx = math.cos(math.radians(lat0)) * 111320 * PX_PER_M * SS
ky = 110540 * PX_PER_M * SS
W, H = int((maxlon - minlon) * kx), int((maxlat - minlat) * ky)


def proj(lat, lon):
    return ((lon - minlon) * kx, (maxlat - lat) * ky)


nodes = {n.get('id'): proj(float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
ways = {}
for w in root.iter('way'):
    pts = [nodes[nd.get('ref')] for nd in w.iter('nd') if nd.get('ref') in nodes]
    tags = {t.get('k'): t.get('v') for t in w.iter('tag')}
    ways[w.get('id')] = (pts, tags)

areas = []  # (pts, tags)
for pts, tags in ways.values():
    if len(pts) > 2 and pts[0] == pts[-1]:
        areas.append((pts, tags))
for r in root.iter('relation'):  # 여러 조각으로 된 영역(멀티폴리곤)
    tags = {t.get('k'): t.get('v') for t in r.iter('tag')}
    if tags.get('type') != 'multipolygon':
        continue
    for m in r.iter('member'):
        if m.get('type') == 'way' and m.get('role') == 'outer' and m.get('ref') in ways:
            pts = ways[m.get('ref')][0]
            if len(pts) > 2:
                areas.append((pts, tags))

# ---------- 스타일 ----------
LAND = (236, 230, 205)
STYLE_AREA = [  # (조건, 색) 앞에 있을수록 먼저(아래에) 그림
    (lambda t: t.get('amenity') in ('university', 'school'), (245, 238, 210)),
    (lambda t: t.get('landuse') == 'residential', (233, 224, 214)),
    (lambda t: t.get('leisure') == 'golf_course', (176, 220, 140)),
    (lambda t: t.get('landuse') == 'grass' or t.get('leisure') == 'park', (168, 214, 128)),
    (lambda t: t.get('natural') == 'wood' or t.get('landuse') == 'forest', (120, 184, 96)),
    (lambda t: t.get('leisure') in ('pitch', 'sports_centre'), (102, 190, 140)),
    (lambda t: t.get('amenity') == 'parking', (214, 210, 202)),
    (lambda t: t.get('natural') == 'water', (120, 196, 232)),
]
ROAD = {  # 종류: (폭 m, 색)
    'secondary': (13, (255, 250, 236)), 'tertiary': (10, (255, 255, 255)),
    'unclassified': (8, (255, 255, 255)), 'residential': (7, (255, 255, 255)),
    'living_street': (6, (255, 255, 255)), 'service': (4.5, (250, 248, 242)),
}
PATH = ('footway', 'path', 'pedestrian', 'steps', 'cycleway')
BUILD = {  # 건물 종류: 지붕 색
    'university': (244, 172, 120), 'school': (244, 172, 120), 'dormitory': (140, 186, 232),
    'commercial': (240, 128, 120), 'retail': (240, 128, 120), 'terrace': (196, 176, 230),
    'residential': (196, 176, 230), 'apartments': (196, 176, 230),
}
BUILD_DEFAULT = (228, 206, 170)


def darker(c, k=0.72):
    return tuple(int(v * k) for v in c)


img = Image.new('RGB', (W, H), LAND)
d = ImageDraw.Draw(img)

# 1) 땅 종류
for cond, color in STYLE_AREA:
    for pts, tags in areas:
        if 'building' not in tags and cond(tags):
            d.polygon(pts, fill=color)

# 운동장 흰 선
for pts, tags in areas:
    if tags.get('leisure') == 'pitch':
        d.polygon(pts, outline=(235, 250, 240), width=3 * SS)

# 2) 숲에 나무 찍기
mask = Image.new('L', (W, H), 0)
md = ImageDraw.Draw(mask)
for pts, tags in areas:
    if tags.get('natural') == 'wood' or tags.get('landuse') == 'forest' or tags.get('leisure') == 'park':
        md.polygon(pts, fill=255)
trees = []
for _ in range(int(W * H / (SS * SS * 70))):
    x, y = random.uniform(0, W), random.uniform(0, H)
    if mask.getpixel((int(x), int(y))):
        trees.append((x, y, random.uniform(3.5, 6) * SS))

# 3) 도로 (테두리 → 안쪽 순서)
roads = [(pts, tags) for pts, tags in ways.values() if tags.get('highway') in ROAD and len(pts) > 1]
for pts, tags in roads:
    w, _ = ROAD[tags['highway']]
    d.line(pts, fill=(196, 186, 162), width=int((w + 2.5) * PX_PER_M * SS), joint='curve')
for pts, tags in roads:
    w, c = ROAD[tags['highway']]
    d.line(pts, fill=c, width=int(w * PX_PER_M * SS), joint='curve')
for pts, tags in roads:  # 큰 길 가운데 노란 선
    if tags['highway'] in ('secondary', 'tertiary'):
        d.line(pts, fill=(250, 210, 90), width=int(0.6 * SS), joint='curve')
for pts, tags in ways.values():
    if tags.get('highway') in PATH and len(pts) > 1:
        for i in range(len(pts) - 1):  # 점선 산책로
            (x1, y1), (x2, y2) = pts[i], pts[i + 1]
            n = max(1, int(math.dist(pts[i], pts[i + 1]) / (6 * SS)))
            for k in range(0, n, 2):
                a, c2 = k / n, min(1, (k + 1) / n)
                d.line([(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a), (x1 + (x2 - x1) * c2, y1 + (y2 - y1) * c2)],
                       fill=(214, 190, 140), width=int(1.6 * SS))

# 4) 나무 (그림자 + 둥근 잎)
for x, y, r in sorted(trees, key=lambda t: t[1]):
    d.ellipse([x - r + 2 * SS, y - r + 3 * SS, x + r + 2 * SS, y + r + 3 * SS], fill=(84, 140, 70))
    d.ellipse([x - r, y - r, x + r, y + r], fill=(92, 166, 82))
    d.ellipse([x - r * 0.5, y - r * 0.6, x + r * 0.1, y - r * 0.05], fill=(126, 196, 106))

# 5) 건물: 그림자 → 벽 → 지붕 (살짝 입체로)
buildings = [(pts, tags) for pts, tags in areas if 'building' in tags]
shadow = Image.new('L', (W, H), 0)
sd = ImageDraw.Draw(shadow)
blds = []
for pts, tags in buildings:
    levels = tags.get('building:levels')
    lv = float(levels) if levels and levels.replace('.', '').isdigit() else (2 if tags['building'] in ('terrace', 'residential') else 3)
    h = lv * 2.2 * PX_PER_M * SS  # 화면에서 위로 올라가는 높이
    blds.append((pts, tags, h))
    sd.polygon([(x + h * 0.7, y + h * 0.35) for x, y in pts], fill=110)
shadow = shadow.filter(ImageFilter.GaussianBlur(3 * SS))
img.paste((60, 50, 40), mask=shadow)
d = ImageDraw.Draw(img)

for pts, tags, h in sorted(blds, key=lambda b: max(p[1] for p in b[0])):
    roof = BUILD.get(tags['building'], BUILD_DEFAULT)
    wall = darker(roof, 0.78)
    top = [(x, y - h) for x, y in pts]
    for i in range(len(pts) - 1):  # 벽 면
        d.polygon([pts[i], pts[i + 1], top[i + 1], top[i]], fill=wall)
    d.polygon(top, fill=roof, outline=darker(roof, 0.6), width=int(1.2 * SS))

# 6) 이름표
font = ImageFont.truetype(FONT, int(11 * SS))
font_big = ImageFont.truetype(FONT, int(16 * SS))
placed = []


def label(x, y, text, f):
    bb = d.textbbox((x, y), text, font=f, anchor='mm')
    box = (bb[0] - 4, bb[1] - 3, bb[2] + 4, bb[3] + 3)
    if any(not (box[2] < p[0] or box[0] > p[2] or box[3] < p[1] or box[1] > p[3]) for p in placed):
        return  # 겹치면 생략
    placed.append(box)
    d.text((x, y), text, font=f, anchor='mm', fill=(50, 44, 40), stroke_width=int(2.5 * SS), stroke_fill=(255, 255, 255))


for pts, tags, h in blds:
    name = tags.get('name:ko') or tags.get('name')
    if name:
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts) - h
        label(cx, cy, name, font)
for n in root.iter('node'):
    tags = {t.get('k'): t.get('v') for t in n.iter('tag')}
    if tags.get('natural') == 'peak' and tags.get('name'):
        x, y = nodes[n.get('id')]
        label(x, y, '⛰ ' + tags['name'] if False else '▲ ' + tags['name'], font_big)

# 7) 출처 표시
small = ImageFont.truetype(FONT, int(10 * SS))
d.text((W - 10 * SS, H - 8 * SS), '지도 데이터 © OpenStreetMap 기여자', font=small, anchor='rd',
       fill=(80, 70, 60), stroke_width=2 * SS, stroke_fill=(255, 255, 255))

img = img.resize((W // SS, H // SS), Image.LANCZOS)
img.save(OUT, optimize=True)
print(f'saved {OUT} {img.size}, buildings={len(blds)}, roads={len(roads)}, trees={len(trees)}')
