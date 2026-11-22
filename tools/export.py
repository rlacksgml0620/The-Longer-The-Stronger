import json, csv, sys, urllib.parse, collections
OUT=sys.argv[1]
d=json.load(open("picked.json",encoding="utf-8"))
e=json.load(open("enrich.json",encoding="utf-8"))
for x in d:
    s=e["sp"].get(x["qid"],{}); g=e["g"].get(x["gqid"],{})
    if s.get("k"): x["ko"]=s["k"]
    if s.get("i"): x["image"]=urllib.parse.unquote(s["i"].rsplit("/",1)[1])
    if g.get("fam"): x["family"]=g["fam"]
    if g.get("ord"): x["order"]=g["ord"]
    del x["gqid"]; del x["src"]
    if not x["extinct"]: del x["extinct"]
d.sort(key=lambda x:(-x["power"],x["name"]))
for i,x in enumerate(d): x["id"]=i
CI={"Mammalia":{"ko":"포유류","en":"Mammals","icon":"🦁"},"Aves":{"ko":"조류","en":"Birds","icon":"🦅"},
 "Reptilia":{"ko":"파충류","en":"Reptiles","icon":"🦎"},"Amphibia":{"ko":"양서류","en":"Amphibians","icon":"🐸"},
 "Fish":{"ko":"경골어류","en":"Bony Fish","icon":"🐟"},"Chondrichthyes":{"ko":"연골어류","en":"Sharks & Rays","icon":"🦈"},
 "Insecta":{"ko":"곤충","en":"Insects","icon":"🐞"},"Arachnida":{"ko":"거미류","en":"Arachnids","icon":"🕷️"},
 "Crustacea":{"ko":"갑각류","en":"Crustaceans","icon":"🦀"},"Myriapoda":{"ko":"다지류","en":"Myriapods","icon":"🐛"},
 "OtherArthro":{"ko":"기타 절지동물","en":"Other Arthropods","icon":"🪲"},"Mollusca":{"ko":"연체동물","en":"Molluscs","icon":"🐌"},
 "Cnidaria":{"ko":"자포동물","en":"Cnidarians","icon":"🪼"},"Echinodermata":{"ko":"극피동물","en":"Echinoderms","icon":"⭐"},
 "Worms":{"ko":"벌레류","en":"Worms","icon":"🪱"},"OtherInv":{"ko":"기타 무척추동물","en":"Other Invertebrates","icon":"🧽"}}
TIERS=json.load(open("tiers.json",encoding="utf-8"))
json.dump({"classes":CI,"tiers":TIERS,"animals":d},open(OUT+"/public/animals.json","w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
json.dump(d,open(OUT+"/data/animals.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
cols=["id","power","name","ko","sci","genus","family","order","cls","extinct","genusNamed","qid","image"]
with open(OUT+"/data/animals.csv","w",encoding="utf-8-sig",newline="") as f:
    w=csv.DictWriter(f,cols,extrasaction="ignore"); w.writeheader(); w.writerows(d)
print(len(d),"exported; ko",sum(1 for x in d if "ko" in x),"img",sum(1 for x in d if "image" in x),"order",sum(1 for x in d if "order" in x))
print(collections.Counter(x["cls"] for x in d).most_common())
