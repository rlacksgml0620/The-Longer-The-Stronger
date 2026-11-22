"""Replace Latin-with-author junk names in public/animals.json (and data/ copies) in place.

Keeps every animal's id (saves reference ids), swaps the junk name for the genus's next-best
English common name from the raw Wikidata dumps. Run from the project root:
    python tools/fix_junk.py <raw_dir>
where <raw_dir> holds raw_*.json and build.py from the original data pipeline.
"""
import json, re, sys, os, csv, glob, collections

raw_dir = sys.argv[1]
cwd = os.getcwd()
os.chdir(raw_dir)
ns = {}
exec(open("build.py", encoding="utf-8").read().split("best={}")[0], ns)  # load helpers only (canonical, titlecase, power)
raws = {f[4:-5]: json.load(open(f, encoding="utf-8")) for f in glob.glob("raw_*.json")}
os.chdir(cwd)

NB = r"(?<![A-Za-z])"  # word start (avoids backslash escapes)

def junk(name, sci, genus):
    w = name.split(); ep = sci.split()[-1].lower()
    if len(w) >= 2 and w[0].lower() == genus.lower() and w[1].lower()[:4] == ep[:4]: return True  # "Genus Epithet Author"
    if re.search(NB + "Et Al$", name) or re.search(NB + "[A-Z]{2,}[a-z]", name) or re.search(" [A-Z]$", name): return True
    return False

by_genus = collections.defaultdict(list)
for d in raws.values():
    gname = {g["genus"]: g["genusName"] for g in d["genera"]}
    for r in d["species"]:
        gn = gname.get(r["genus"]) or r.get("genusName")
        if gn: by_genus[gn].append(r)

DB = json.load(open("public/animals.json", encoding="utf-8"))
names_taken = {a["name"].lower() for a in DB["animals"]}
fixed, typo, dropped = [], [], []
for a in DB["animals"]:
    if a["name"].isupper():  # e.g. "GIULIANI'S DUNE SCARAB BEETLE"
        a["name"] = ns["titlecase"](a["name"].title().replace("'S ", "'s "))
        typo.append(a["name"])
        continue
    if re.search(NB + "[A-Z]{2}[a-z]", a["name"]) and a["name"].split()[0].lower() != a["genus"].lower():
        a["name"] = re.sub(NB + "([A-Z])([A-Z])([a-z])", lambda m: m.group(1) + m.group(2).lower() + m.group(3), a["name"])  # "VIscacha" typo
        typo.append(a["name"])
        continue
    if not junk(a["name"], a["sci"], a["genus"]): continue
    best = None
    seen = set()
    for r in by_genus[a["genus"]]:
        if r["sp"] in seen: continue
        seen.add(r["sp"])
        n = ns["canonical"](r, a["genus"])
        if not n: continue
        n = ns["titlecase"](n)
        if junk(n, r["spName"], a["genus"]) or n.lower() in names_taken: continue
        key = (ns["power"](n), len(n), n)
        if best is None or key > best[0]: best = (key, n, r)
    old = a["name"]
    if best:
        _, n, r = best
        names_taken.add(n.lower())
        a.update(name=n, power=ns["power"](n), sci=r["spName"], qid=r["sp"].rsplit("/", 1)[1])
        a.pop("image", None); a.pop("ko", None)  # belonged to the old species
        fixed.append((old, n, a["power"]))
    else:
        a["hidden"] = True  # no usable English name: excluded from gacha/opponents, still shown to owners
        dropped.append(old)

json.dump(DB, open("public/animals.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump(DB["animals"], open("data/animals.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
cols = ["id", "power", "name", "ko", "sci", "genus", "family", "order", "cls", "extinct", "hidden", "genusNamed", "qid", "image"]
with open("data/animals.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, cols, extrasaction="ignore"); w.writeheader(); w.writerows(DB["animals"])
for n in typo: print(f"CASE   {n}")
for o, n, p in fixed: print(f"FIXED  {o}  ->  {n} ({p})")
for o in dropped: print(f"HIDDEN {o}")
