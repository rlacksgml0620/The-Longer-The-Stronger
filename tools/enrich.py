import json, sys, time
exec(open("ql.py").read().split("# all species")[0])
def q(s):
    for k in range(4):
        try: return ql(s)
        except Exception as e: print(" retry",k,e,file=sys.stderr,flush=True); time.sleep(3)
    return []
d=json.load(open("picked.json",encoding="utf-8"))
ids=[x["qid"] for x in d]; gids=sorted({x["gqid"] for x in d})
info={}
for i in range(0,len(ids),1500):
    for r in q("""SELECT ?s (SAMPLE(?ko) AS ?k) (SAMPLE(?img) AS ?i) WHERE { VALUES ?s { %s }
      OPTIONAL{?s rdfs:label ?ko FILTER(lang(?ko)="ko")} OPTIONAL{?s wdt:P18 ?img} } GROUP BY ?s""" % " ".join("wd:"+x for x in ids[i:i+1500])):
        info[r["s"].rsplit("/",1)[1]]=r
    print("sp",i,len(info),file=sys.stderr,flush=True)
ginfo={}
for i in range(0,len(gids),300):
    for r in q("""SELECT ?g (SAMPLE(?fn) AS ?fam) (SAMPLE(?on) AS ?ord) WHERE { VALUES ?g { %s }
      OPTIONAL{?g wdt:P171 ?f. ?f wdt:P105 wd:Q35409. ?f wdt:P225 ?fn}
      OPTIONAL{?g wdt:P171/wdt:P171 ?o1. ?o1 wdt:P105 wd:Q36602. ?o1 wdt:P225 ?on1}
      OPTIONAL{?g wdt:P171/wdt:P171/wdt:P171 ?o2. ?o2 wdt:P105 wd:Q36602. ?o2 wdt:P225 ?on2}
      OPTIONAL{?g wdt:P171/wdt:P171/wdt:P171/wdt:P171 ?o3. ?o3 wdt:P105 wd:Q36602. ?o3 wdt:P225 ?on3}
      BIND(COALESCE(?on1,?on2,?on3) AS ?on) } GROUP BY ?g""" % " ".join("wd:"+x for x in gids[i:i+300])):
        ginfo[r["g"].rsplit("/",1)[1]]=r
    print("g",i,len(ginfo),file=sys.stderr,flush=True)
json.dump({"sp":info,"g":ginfo},open("enrich.json","w",encoding="utf-8"),ensure_ascii=False)
