"""OpenStreetMap 데이터(.osm)를 게임 지도 스타일 이미지로 그리는 도구.

사용법:
  python3 tools/render_map.py data/jnu.osm public/maps/jnu.png day
  python3 tools/render_map.py data/jnu.osm public/maps/jnu-night.png night
낮(day)을 그릴 때는 지도 위 장소 목록(*.pois.json)도 함께 저장한다.
지도 데이터 © OpenStreetMap 기여자 (ODbL)
"""
import json
import math
import random
import sys
import xml.etree.ElementTree as ET

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

SRC = sys.argv[1] if len(sys.argv) > 1 else 'data/jnu.osm'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'map.png'
THEME = sys.argv[3] if len(sys.argv) > 3 else 'day'
NIGHT = THEME == 'night'
PX_PER_M = 1.0   # 최종 이미지 1픽셀 = 1미터
SS = 2           # 계단 현상 줄이기용 2배로 그린 뒤 축소
FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
random.seed(7)

# ---------- 색 (낮 / 밤 축제) ----------
P = {
    'land':        ((236, 230, 205), (34, 38, 62)),
    'campus':      ((245, 238, 210), (40, 44, 70)),
    'residential': ((233, 224, 214), (44, 42, 66)),
    'golf':        ((176, 220, 140), (34, 62, 60)),
    'grass':       ((168, 214, 128), (36, 70, 62)),
    'wood':        ((120, 184, 96), (26, 54, 48)),
    'pitch':       ((102, 190, 140), (30, 84, 74)),
    'parking':     ((214, 210, 202), (52, 54, 74)),
    'water':       ((120, 196, 232), (40, 80, 130)),
    'pitch_line':  ((235, 250, 240), (120, 170, 150)),
    'road_edge':   ((196, 186, 162), (24, 26, 42)),
    'road_main':   ((255, 250, 236), (86, 78, 90)),
    'road':        ((255, 255, 255), (72, 70, 88)),
    'road_service': ((250, 248, 242), (62, 62, 82)),
    'center_line': ((250, 210, 90), (255, 196, 110)),
    'path':        ((214, 190, 140), (120, 104, 96)),
    'tree_shadow': ((84, 140, 70), (14, 30, 28)),
    'tree':        ((92, 166, 82), (30, 72, 58)),
    'tree_hi':     ((126, 196, 106), (48, 98, 74)),
    'text':        ((50, 44, 40), (255, 244, 225)),
    'halo':        ((255, 255, 255), (20, 20, 36)),
}
C = {k: v[1] if NIGHT else v[0] for k, v in P.items()}
BUILD_DAY = {
    'university': (244, 172, 120), 'school': (244, 172, 120), 'dormitory': (140, 186, 232),
    'commercial': (240, 128, 120), 'retail': (240, 128, 120), 'terrace': (196, 176, 230),
    'residential': (196, 176, 230), 'apartments': (196, 176, 230),
}
BUILD_NIGHT = {
    'university': (120, 82, 92), 'school': (120, 82, 92), 'dormitory': (70, 86, 130),
    'commercial': (130, 66, 76), 'retail': (130, 66, 76), 'terrace': (92, 80, 120),
    'residential': (92, 80, 120), 'apartments': (92, 80, 120),
}
BUILD = BUILD_NIGHT if NIGHT else BUILD_DAY
BUILD_DEFAULT = (104, 90, 96) if NIGHT else (228, 206, 170)

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

STYLE_AREA = [  # 앞에 있을수록 먼저(아래에) 그림
    (lambda t: t.get('amenity') in ('university', 'school'), C['campus']),
    (lambda t: t.get('landuse') == 'residential', C['residential']),
    (lambda t: t.get('leisure') == 'golf_course', C['golf']),
    (lambda t: t.get('landuse') == 'grass' or t.get('leisure') == 'park', C['grass']),
    (lambda t: t.get('natural') == 'wood' or t.get('landuse') == 'forest', C['wood']),
    (lambda t: t.get('leisure') in ('pitch', 'sports_centre'), C['pitch']),
    (lambda t: t.get('amenity') == 'parking', C['parking']),
    (lambda t: t.get('natural') == 'water', C['water']),
]
ROAD = {  # 종류: (폭 m, 색 이름)
    'secondary': (13, 'road_main'), 'tertiary': (10, 'road'), 'unclassified': (8, 'road'),
    'residential': (7, 'road'), 'living_street': (6, 'road'), 'service': (4.5, 'road_service'),
}
PATH = ('footway', 'path', 'pedestrian', 'steps', 'cycleway')


def darker(c, k=0.72):
    return tuple(int(v * k) for v in c)


img = Image.new('RGB', (W, H), C['land'])
d = ImageDraw.Draw(img)

# 1) 땅 종류
for cond, color in STYLE_AREA:
    for pts, tags in areas:
        if 'building' not in tags and cond(tags):
            d.polygon(pts, fill=color)
for pts, tags in areas:  # 운동장 흰 선
    if tags.get('leisure') == 'pitch':
        d.polygon(pts, outline=C['pitch_line'], width=3 * SS)

# 2) 숲에 나무 찍을 자리
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
    d.line(pts, fill=C['road_edge'], width=int((w + 2.5) * PX_PER_M * SS), joint='curve')
for pts, tags in roads:
    w, c = ROAD[tags['highway']]
    d.line(pts, fill=C[c], width=int(w * PX_PER_M * SS), joint='curve')
for pts, tags in roads:  # 큰 길 가운데 선
    if tags['highway'] in ('secondary', 'tertiary'):
        d.line(pts, fill=C['center_line'], width=int(0.6 * SS), joint='curve')
for pts, tags in ways.values():
    if tags.get('highway') in PATH and len(pts) > 1:
        for i in range(len(pts) - 1):  # 점선 산책로
            (x1, y1), (x2, y2) = pts[i], pts[i + 1]
            n = max(1, int(math.dist(pts[i], pts[i + 1]) / (6 * SS)))
            for k in range(0, n, 2):
                a, c2 = k / n, min(1, (k + 1) / n)
                d.line([(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a), (x1 + (x2 - x1) * c2, y1 + (y2 - y1) * c2)],
                       fill=C['path'], width=int(1.6 * SS))

# 4) 나무 (그림자 + 둥근 잎)
for x, y, r in sorted(trees, key=lambda t: t[1]):
    d.ellipse([x - r + 2 * SS, y - r + 3 * SS, x + r + 2 * SS, y + r + 3 * SS], fill=C['tree_shadow'])
    d.ellipse([x - r, y - r, x + r, y + r], fill=C['tree'])
    d.ellipse([x - r * 0.5, y - r * 0.6, x + r * 0.1, y - r * 0.05], fill=C['tree_hi'])

# 5) 건물: 그림자 → 벽 → 지붕 (살짝 입체로)
buildings = [(pts, tags) for pts, tags in areas if 'building' in tags]
shadow = Image.new('L', (W, H), 0)
sd = ImageDraw.Draw(shadow)
blds = []
for pts, tags in buildings:
    levels = tags.get('building:levels')
    lv = float(levels) if levels and levels.replace('.', '').isdigit() else (2 if tags['building'] in ('terrace', 'residential') else 3)
    h = lv * 2.2 * PX_PER_M * SS  # 화면에서 위로 올라가는 높이
    blds.append((pts, tags, h, lv))
    sd.polygon([(x + h * 0.7, y + h * 0.35) for x, y in pts], fill=150 if NIGHT else 110)
shadow = shadow.filter(ImageFilter.GaussianBlur(3 * SS))
img.paste((10, 8, 20) if NIGHT else (60, 50, 40), mask=shadow)
d = ImageDraw.Draw(img)

glow = Image.new('RGB', (W, H), (0, 0, 0))  # 밤: 빛 번짐을 따로 그렸다가 더함
gd = ImageDraw.Draw(glow)
WINDOW = (255, 214, 140)
for pts, tags, h, lv in sorted(blds, key=lambda b: max(p[1] for p in b[0])):
    roof = BUILD.get(tags['building'], BUILD_DEFAULT)
    wall = darker(roof, 0.78)
    top = [(x, y - h) for x, y in pts]
    for i in range(len(pts) - 1):  # 벽 면
        d.polygon([pts[i], pts[i + 1], top[i + 1], top[i]], fill=wall)
        if NIGHT and pts[i + 1][1] >= pts[i][1] - 1 and pts[i][0] != pts[i + 1][0]:
            # 아래쪽을 향한 벽에 불 켜진 창문
            (x1, y1), (x2, y2) = pts[i], pts[i + 1]
            L = math.dist(pts[i], pts[i + 1])
            for fl in range(int(lv)):
                for k in range(1, int(L / (5 * SS))):
                    if random.random() < 0.55:
                        t = k * 5 * SS / L
                        wx, wy = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - (fl + 0.55) * (h / lv)
                        d.rectangle([wx - 1.2 * SS, wy - 1.4 * SS, wx + 1.2 * SS, wy + 1.4 * SS], fill=WINDOW)
                        gd.ellipse([wx - 5 * SS, wy - 5 * SS, wx + 5 * SS, wy + 5 * SS], fill=(90, 60, 20))
    d.polygon(top, fill=roof, outline=darker(roof, 0.6), width=int(1.2 * SS))

# 6) 밤 축제: 큰길을 따라 청사초롱 (빨강·파랑 등불)
lanterns = []
if NIGHT:
    for pts, tags in roads:
        if tags['highway'] not in ROAD:
            continue
        w = ROAD[tags['highway']][0] * PX_PER_M * SS
        step = (24 if tags['highway'] in ('secondary', 'tertiary') else 32) * PX_PER_M * SS
        carry = 0
        for i in range(len(pts) - 1):
            (x1, y1), (x2, y2) = pts[i], pts[i + 1]
            L = math.dist(pts[i], pts[i + 1])
            if L == 0:
                continue
            nx, ny = -(y2 - y1) / L, (x2 - x1) / L  # 길 옆쪽 방향
            t = carry
            while t < L:
                px, py = x1 + (x2 - x1) * t / L, y1 + (y2 - y1) * t / L
                for side in (-1, 1):
                    lanterns.append((px + nx * side * (w / 2 + 2 * SS), py + ny * side * (w / 2 + 2 * SS)))
                t += step
            carry = t - L
    for x, y in lanterns:
        gd.ellipse([x - 9 * SS, y - 9 * SS, x + 9 * SS, y + 9 * SS], fill=(110, 48, 14))
    glow = glow.filter(ImageFilter.GaussianBlur(6 * SS))
    img = ImageChops.add(img, glow)
    d = ImageDraw.Draw(img)
    for x, y in lanterns:  # 등불 본체: 위는 빨강, 아래는 파랑
        r = 2.4 * SS
        d.ellipse([x - r, y - r * 1.3, x + r, y + r * 1.3], fill=(230, 60, 60))
        d.chord([x - r, y - r * 1.3, x + r, y + r * 1.3], 20, 160, fill=(60, 110, 220))
        d.ellipse([x - r * 0.45, y - r * 0.6, x + r * 0.45, y + r * 0.2], fill=(255, 230, 170))

# 7) 이름표
font = ImageFont.truetype(FONT, int(11 * SS))
font_big = ImageFont.truetype(FONT, int(16 * SS))
placed = []


def label(x, y, text, f):
    bb = d.textbbox((x, y), text, font=f, anchor='mm')
    box = (bb[0] - 4, bb[1] - 3, bb[2] + 4, bb[3] + 3)
    if any(not (box[2] < p[0] or box[0] > p[2] or box[3] < p[1] or box[1] > p[3]) for p in placed):
        return  # 겹치면 생략
    placed.append(box)
    d.text((x, y), text, font=f, anchor='mm', fill=C['text'], stroke_width=int(2.5 * SS), stroke_fill=C['halo'])


for pts, tags, h, lv in blds:
    name = tags.get('name:ko') or tags.get('name')
    if name:
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts) - h
        label(cx, cy, name, font)
for n in root.iter('node'):
    tags = {t.get('k'): t.get('v') for t in n.iter('tag')}
    if tags.get('natural') == 'peak' and tags.get('name'):
        x, y = nodes[n.get('id')]
        label(x, y, '▲ ' + tags['name'], font_big)

# 8) 출처 표시
small = ImageFont.truetype(FONT, int(10 * SS))
d.text((W - 10 * SS, H - 8 * SS), '지도 데이터 © OpenStreetMap 기여자', font=small, anchor='rd',
       fill=C['text'], stroke_width=2 * SS, stroke_fill=C['halo'])

img = img.resize((W // SS, H // SS), Image.LANCZOS)
img.save(OUT, optimize=True)
print(f'saved {OUT} {img.size}, buildings={len(blds)}, roads={len(roads)}, trees={len(trees)}, lanterns={len(lanterns)}')

# 9) 낮 지도를 그릴 때 장소 목록도 저장 (지도 페이지의 핀으로 사용)
if not NIGHT:
    KIND = {'convenience': '편의점', 'cafe': '카페', 'restaurant': '식당', 'pharmacy': '약국',
            'post_office': '우체국', 'library': '도서관', 'hospital': '병원', 'bank': '은행',
            'fast_food': '패스트푸드', 'bar': '주점', 'veterinary': '동물병원', 'supermarket': '마트'}
    pois = []
    for n in root.iter('node'):
        tags = {t.get('k'): t.get('v') for t in n.iter('tag')}
        kind = tags.get('shop') or tags.get('amenity')
        if kind in KIND and tags.get('name'):
            x, y = nodes[n.get('id')]
            pois.append({'name': tags.get('name:ko') or tags['name'], 'kind': KIND[kind],
                         'x': round(x / SS), 'y': round(y / SS)})
    for pts, tags in areas:  # 이름 있는 시설 건물/영역
        kind = tags.get('shop') or tags.get('amenity')
        if kind in KIND and tags.get('name'):
            cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
            pois.append({'name': tags.get('name:ko') or tags['name'], 'kind': KIND[kind],
                         'x': round(cx / SS), 'y': round(cy / SS)})
    with open(OUT.rsplit('.', 1)[0] + '.pois.json', 'w', encoding='utf-8') as f:
        json.dump({'width': W // SS, 'height': H // SS, 'pois': pois}, f, ensure_ascii=False, indent=1)
    print(f'pois={len(pois)}')
