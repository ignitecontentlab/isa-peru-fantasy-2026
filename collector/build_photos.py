#!/usr/bin/env python3
"""Find freely licensed headshots on Wikipedia/Wikimedia Commons for surfers in data/athletes.json.
Page must be described as a surfer; image licence must be CC / public domain; existing entries are kept;
data/photos_manual.json overrides everything. Surfers without a verified photo get initials on the site."""
import json, os, re, time, urllib.parse
import requests

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
API = "https://en.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
HDR = {"User-Agent": "isa-fantasy-photo-builder/1.0 (private fantasy league)"}

def load(n, d):
    p = os.path.join(D, n)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d

def parse_pages(js):
    q = js.get("query", {})
    alias = {}
    for k in ("normalized", "redirects"):
        for m in q.get(k, []): alias[m["from"]] = m["to"]
    pages = {p["title"]: p for p in q.get("pages", {}).values() if "missing" not in p}
    out = {}
    for req in list(alias) + list(pages):
        t = req
        while t in alias: t = alias[t]
        p = pages.get(t)
        if p and p.get("thumbnail"):
            out[req] = {"title": p["title"], "description": p.get("description", ""), "image_name": p.get("pageimage"), "thumb": p["thumbnail"]["source"]}
        elif p:
            out.setdefault(req, {"title": p["title"], "description": p.get("description", ""), "image_name": None, "thumb": None})
    return out

def is_surfer(desc): return bool(re.search(r"surf", desc or "", re.I))

def ok_license(meta):
    lic = (meta.get("LicenseShortName", {}).get("value") or "")
    return bool(re.match(r"(CC[ -]|Public domain|PD)", lic, re.I)), lic

def strip_html(s): return re.sub(r"<[^>]+>", "", s or "").strip()

def file_meta(name):
    r = requests.get(COMMONS, params={"action": "query", "titles": "File:" + name, "prop": "imageinfo",
                     "iiprop": "extmetadata", "format": "json"}, headers=HDR, timeout=30).json()
    for p in r.get("query", {}).get("pages", {}).values():
        ii = p.get("imageinfo")
        if ii: return ii[0].get("extmetadata", {})
    return {}

def main():
    ath = load("athletes.json", []); photos = load("photos.json", {}); manual = load("photos_manual.json", {})
    todo = [a for a in ath if f'{a["division"]}|{a["name"]}' not in photos]
    todo.sort(key=lambda a: not a.get("manager"))
    for i in range(0, len(todo), 40):
        batch = todo[i:i + 40]
        try:
            js = requests.get(API, params={"action": "query", "titles": "|".join(a["name"].replace(" ", "_") for a in batch),
                              "prop": "pageimages|description", "piprop": "thumbnail|name", "pithumbsize": 400,
                              "redirects": 1, "format": "json"}, headers=HDR, timeout=30).json()
        except Exception as e:
            print("batch failed", e); continue
        found = parse_pages(js)
        for a in batch:
            key = f'{a["division"]}|{a["name"]}'
            rec = found.get(a["name"].replace(" ", "_")) or found.get(a["name"])
            if not rec or not rec["thumb"] or not is_surfer(rec["description"]):
                photos[key] = {"url": None, "reason": "no verified match"}; continue
            meta = file_meta(rec["image_name"]) if rec["image_name"] else {}
            ok, lic = ok_license(meta)
            if not ok:
                photos[key] = {"url": None, "reason": "licence not free: " + lic}; continue
            photos[key] = {"url": rec["thumb"], "credit": strip_html(meta.get("Artist", {}).get("value")) or "Wikimedia Commons",
                           "license": lic, "page": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(rec["title"].replace(" ", "_"))}
        time.sleep(1)
    photos.update(manual)
    json.dump(photos, open(os.path.join(D, "photos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"photos: {sum(1 for v in photos.values() if v.get('url'))} found / {len(photos)} checked")

if __name__ == "__main__":
    main()
