#!/usr/bin/env python3
"""ISA 2026 WSG collector v2: SurfScores results pages + live JSON.
Rounds are identified by block order (B01, B02...) because the results page does not label them.
Real names (e.g. REPECHAGE 4) are learned from the live feed into data/round_names.json."""
import json, os, re, unicodedata, datetime as dt
import requests
from bs4 import BeautifulSoup

BASE = "https://surfscores.com/PER/2026/isawsg/"
LIVE = "https://surfscores.com/scoreboard/getlive.php?eventid=PER2026ISAWSG&catname=&heatid="
HDR = {"User-Agent": "Mozilla/5.0 (compatible; fantasy-collector)"}
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
os.makedirs(D, exist_ok=True)

def load(name, default):
    p = os.path.join(D, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else default

def save(name, obj):
    tmp = os.path.join(D, name + ".tmp")
    json.dump(obj, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, os.path.join(D, name))

def num(s):
    try: return float((s or "").strip().replace(",", "."))
    except ValueError: return None

def norm(s):
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return re.sub(r"[^a-z]", "", s.lower())

def heat_key(division, names):
    return division + "|" + "|".join(sorted(norm(n) for n in names))

def get(url):
    r = requests.get(url, headers=HDR, timeout=30)
    return r.status_code, r.text

def parse_results(html, division):
    soup = BeautifulSoup(html, "html.parser")
    out, block, prev = [], 1, 0
    for t in soup.find_all("table"):
        if t.find("table"): continue
        rows = [[c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])] for tr in t.find_all("tr")]
        rows = [r for r in rows if any(r)]
        if not rows: continue
        head = " ".join(rows[0]).upper()
        m = re.search(r"HEAT\s*(\d+)", head)
        is_final = (not m) and re.match(r"\s*(GRAND\s*)?FINAL", head)
        if not m and not is_final: continue
        heat = int(m.group(1)) if m else 1
        if out and (is_final or heat <= prev): block += 1
        prev = 0 if is_final else heat
        surfers = []
        for r in rows[1:]:
            cells = [c for c in r if c != ""]
            if len(cells) < 2: continue
            surfers.append({"name": cells[0], "country": cells[1][:3].upper(),
                            "total": num(cells[2]) if len(cells) > 2 else None,
                            "place": int(cells[3]) if len(cells) > 3 and cells[3].isdigit() else None})
        if not surfers: continue
        complete = all(s["total"] is not None and s["place"] for s in surfers)
        out.append({"division": division, "round": f"B{block:02d}", "heat": heat, "surfers": surfers, "complete": complete})
    return out

def col_waves(td):
    waves = []
    for a in td.select("div.avg.topscore"):
        j = a.find_next_sibling("div", class_="jscores")
        waves.append({"score": num(a.get_text()), "judges": [num(x.get_text()) for x in j.find_all("span")] if j else []})
    return waves

def parse_live(js):
    if not isinstance(js, dict) or "standings" not in js: return None
    parts = [p.strip() for p in js.get("CatDescr", "").split(" - ")]
    division = parts[0].lower() if parts and parts[0] else (js.get("category") or "").lower()
    rnd = parts[1].upper() if len(parts) > 2 else "UNKNOWN"
    hm = re.search(r"HEAT\s*(\d+)", parts[-1] if parts else "", re.I)
    st = BeautifulSoup(js.get("standings", ""), "html.parser")
    sc = BeautifulSoup(js.get("scores", ""), "html.parser")
    cols = {}
    for td in sc.select("td.scorecol"):
        head = td.select_one("div.head")
        c = re.search(r"background-color:\s*(#[0-9A-Fa-f]+)", head.get("style", "")) if head else None
        if c: cols[c.group(1).upper()] = col_waves(td)
    surfers = []
    for s in st.select("div.surfer"):
        pl = s.select_one("div.place")
        c = re.search(r"background-color:\s*(#[0-9A-Fa-f]+)", pl.get("style", "")) if pl else None
        pn = re.match(r"\d+", pl.get_text(strip=True)) if pl else None
        bt = s.select_one("div.best"); pr = s.select_one("div.priority")
        w = cols.get(c.group(1).upper(), []) if c else []
        surfers.append({"name": s.select_one("div.name").get_text(strip=True),
                        "country": s.select_one("div.info").get_text(strip=True)[:3].upper(),
                        "place": int(pn.group()) if pn else None,
                        "total": num(s.select_one("div.score").get_text(strip=True)),
                        "best_waves": [num(x) for x in bt.get_text(strip=True).split("+")] if bt else [],
                        "priority": pr.get_text(strip=True) if pr else None,
                        "waves": [x["score"] for x in w], "wave_detail": w})
    return {"division": division, "round": rnd, "heat": int(hm.group(1)) if hm else None,
            "heat_id": js.get("heat"), "status": js.get("heatstatus"),
            "minleft": js.get("minleft"), "secleft": js.get("secleft"),
            "end": js.get("endofheat"), "surfers": surfers}

def merge(history, new):
    idx = {(h["division"], h["round"], h["heat"]): i for i, h in enumerate(history)}
    for h in new:
        k = (h["division"], h["round"], h["heat"])
        if k not in idx: history.append(h)
        elif not history[idx[k]]["complete"]: history[idx[k]] = h
    return history

def learn_names(history, live, names):
    if not live or not live.get("surfers") or live["round"] == "UNKNOWN": return
    lk = heat_key(live["division"], [s["name"] for s in live["surfers"]])
    for h in history:
        if h["division"] == live["division"] and heat_key(h["division"], [s["name"] for s in h["surfers"]]) == lk:
            names.setdefault(h["division"], {})[h["round"]] = live["round"]; return

def attach_waves(history, wstore):
    for h in history:
        w = wstore.get(heat_key(h["division"], [s["name"] for s in h["surfers"]]))
        if not w: continue
        for s in h["surfers"]:
            x = w.get(norm(s["name"]))
            if x: s["waves"] = x["waves"]; s["best_waves"] = x["best_waves"]

def main():
    health = {"run_utc": dt.datetime.utcnow().isoformat() + "Z", "sources": {}}
    hist = load("heats.json", []); wstore = load("waves.json", {}); names = load("round_names.json", {})
    ok = False; live = None
    for div, page in (("men", "men.php"), ("women", "women.php")):
        try:
            code, html = get(BASE + page)
            heats = parse_results(html, div) if code == 200 else []
            if heats: hist = merge(hist, heats); ok = True
            health["sources"][page] = {"status": code, "heats_parsed": len(heats), "completed": sum(h["complete"] for h in heats)}
        except Exception as e:
            health["sources"][page] = {"error": str(e)}
    try:
        code, txt = get(LIVE)
        e = {"status": code, "bytes": len(txt)}
        live = parse_live(json.loads(txt)) if code == 200 else None
        e["parsed"] = bool(live)
        if live and live["surfers"]:
            live["fetched_utc"] = health["run_utc"]; save("live.json", live)
            cur = wstore.setdefault(heat_key(live["division"], [s["name"] for s in live["surfers"]]), {})
            for s in live["surfers"]:
                if s["waves"] or norm(s["name"]) not in cur:
                    cur[norm(s["name"])] = {"waves": s["waves"], "best_waves": s["best_waves"]}
            save("waves.json", wstore); ok = True
        health["sources"]["getlive"] = e
    except Exception as e:
        health["sources"]["getlive"] = {"error": str(e)}
    learn_names(hist, live, names); save("round_names.json", names)
    attach_waves(hist, wstore)
    if hist: save("heats.json", hist)
    men = health["sources"].get("men.php", {}).get("heats_parsed"); wom = health["sources"].get("women.php", {}).get("heats_parsed")
    if men is not None and men == wom: health["warning"] = "men and women heat counts identical - verify parsing"
    health["last_success_utc"] = health["run_utc"] if ok else load("health.json", {}).get("last_success_utc")
    save("health.json", health)
    print(json.dumps(health, indent=1)); print("heats stored:", len(hist))

if __name__ == "__main__":
    main()
