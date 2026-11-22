import json, re, sys, glob, collections
CAT = {"Mammalia":"Mammalia","Aves":"Aves","Reptilia":"Reptilia","Amphibia":"Amphibia",
 "Actinopterygii":"Fish","Myxini":"Fish","Petromyzonti":"Fish","Dipnoi":"Fish","Actinistia":"Fish",
 "Chondrichthyes":"Chondrichthyes","Insecta":"Insecta","Arachnida":"Arachnida",
 "Malacostraca":"Crustacea","Thecostraca":"Crustacea","Branchiopoda":"Crustacea","Ostracoda":"Crustacea",
 "Chilopoda":"Myriapoda","Diplopoda":"Myriapoda",
 "Merostomata":"OtherArthro","Collembola":"OtherArthro","Onychophora":"OtherArthro","Tardigrada":"OtherArthro",
 "Mollusca":"Mollusca","Cnidaria":"Cnidaria","Echinodermata":"Echinodermata",
 "Annelida":"Worms","Platyhelminthes":"Worms","Nematoda":"Worms","Nemertea":"Worms","Rotifera":"Worms",
 "Porifera":"OtherInv","Ctenophora":"OtherInv","Bryozoa":"OtherInv","Brachiopoda":"OtherInv","Tunicata":"OtherInv","Leptocardii":"OtherInv"}
# order matters: vertebrate classes first so a genus listed twice keeps the more specific bucket
ORDER = list(CAT)
EXTINCT = {"Q237350","Q239509"}
raws = {f[4:-5]: json.load(open(f,encoding="utf-8")) for f in glob.glob("raw_*.json")}
GENERA = {g["genusName"] for d in raws.values() for g in d["genera"]}
VOC=collections.Counter()
for d in raws.values():
    for r in d["species"]:
        for nm in set([r.get("label","")]+(r.get("cns") or "").split("|")):
            for wd in set(nm.lower().replace("-"," ").split()): VOC[wd]+=1
LAT=r"(a|us|is|um|es|ia|ae|i|ii|ata|ella|ina|ana|ica|aria|alis|ensis|ops|ix|ax|on|os)$"
BLOCK={"tripteridia olivaceata","erbessa cingulina","stempfferia marginata","bastilla joviana","pyrocleptria cora","acanthoderes parva","hybridoneura picta","pagodatrochus variabilis","seidlia gracilis","palleopa innotata","arges yui","grotella melanocrypta"}
def clean(s): return re.sub(r"\s+"," ",s.strip().rstrip(".").strip())
def bad(s, sp, genus):
    if not s or "�" in s: return True
    if s.lower() in (sp.lower(), genus.lower()) or s.lower() in BLOCK: return True
    w = s.split(" ")
    if w[0] in GENERA and all(x.islower() for x in w[1:]): return True   # Latin binomial / synonym
    if len(w)==1 and s in GENERA: return True
    ep = sp.split(" ")[-1].lower()
    if len(w)==2 and len(ep)>=5 and w[1].lower()[:5]==ep[:5] and re.search(r"(a|us|is|um|es|on|ia|ops|ax|yx|ix|os|ys|as)$", w[0]): return True
    if len(w)==2 and w[1].islower() and w[1].endswith(("us","um","ae","ii","ensis","oides")) : return True
    if len(w)==2 and all(VOC[x.lower()]<=3 for x in w) and re.search(LAT, w[1].lower()): return True
    if len(w)==2 and re.search(LAT,w[0].lower()) and re.search(LAT,w[1].lower()) and VOC[w[1].lower()]<=5 and VOC[w[0].lower()]<=10: return True
    if re.search(r"[()\[\]\d/;:,&]", s): return True
    if not re.fullmatch(r"[A-Za-z'’\- ]+", s.translate(str.maketrans("éèüöäçñ","eeuoacn"))): return True
    return False
def canonical(r, genus):
    sp = r["spName"]; lab = clean(r.get("label",""))
    if lab and not bad(lab, sp, genus): return lab
    cns = [c for c in (clean(c) for c in (r.get("cns") or "").split("|")) if not bad(c, sp, genus)]
    if not cns: return None
    groups = collections.defaultdict(list)
    for c in cns: groups[c.lower()].append(c)
    return max(groups.values(), key=lambda g:(len(g), -len(g[0])))[0]
SMALL={"of","the","and","de","du","la","le","von","van","da","del","des","y","in","on"}
def titlecase(n):
    res=[]
    for k,w in enumerate(n.replace("’","'").split(" ")):
        if k>0 and w.lower() in SMALL: res.append(w.lower()); continue
        parts=w.split("-")
        parts=[p[:1].upper()+p[1:] if j==0 else p for j,p in enumerate(parts)]
        res.append("-".join(parts))
    return " ".join(res)
def power(n): return len(re.sub(r"[^A-Za-z]","",n.translate(str.maketrans("éèüöäçñ","eeuoacn"))))
best={}; cnt=collections.Counter(); owner={}
for src in ORDER:
    if src not in raws: continue
    d=raws[src]; gname={g["genus"]:g["genusName"] for g in d["genera"]}
    for r in d["species"]:
        g=r["genus"]
        if owner.setdefault(g,src)!=src: continue
        gn=gname.get(g) or r.get("genusName")
        if not gn: continue
        n=canonical(r,gn)
        if not n: continue
        n=titlecase(n); cnt[g]+=1
        key=(power(n),len(n),n)
        if g not in best or key>best[g][0]:
            best[g]=(key,dict(name=n,power=power(n),sci=r["spName"],genus=gn,cls=CAT[src],src=src,
                qid=r["sp"].rsplit("/",1)[1],gqid=g.rsplit("/",1)[1],extinct=r.get("status","").rsplit("/",1)[-1] in EXTINCT))
out=[]
for g,v in best.items(): v[1]["genusNamed"]=cnt[g]; out.append(v[1])
seen=set(); ded=[]
for x in sorted(out,key=lambda x:-x["genusNamed"]):
    if x["name"].lower() in seen: continue
    seen.add(x["name"].lower()); ded.append(x)
print("dupes removed",len(out)-len(ded),file=sys.stderr)
json.dump(ded,open("picked.json","w",encoding="utf-8"),ensure_ascii=False)
c=collections.Counter(x["cls"] for x in ded)
print(len(ded),dict(c),file=sys.stderr)
