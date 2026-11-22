import json, sys, time, urllib.request, urllib.parse
PFX="""PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""
def ql(q):
    req=urllib.request.Request("https://qlever.dev/api/wikidata",data=urllib.parse.urlencode({"query":PFX+q}).encode(),
        headers={"Accept":"application/sparql-results+json","User-Agent":"LongerStrongerGameBuilder/0.1","Content-Type":"application/x-www-form-urlencoded"})
    d=json.load(urllib.request.urlopen(req,timeout=900))
    return [{k:v["value"] for k,v in b.items()} for b in d["results"]["bindings"]]
# all species under a taxon, with en label or en common names
Q="""SELECT ?sp ?spName ?genus ?genusName ?label (GROUP_CONCAT(DISTINCT ?cn;separator="|") AS ?cns) (SAMPLE(?st) AS ?status) WHERE {
 ?genus wdt:P171+ wd:%s . ?genus wdt:P105 wd:Q34740 . ?genus wdt:P225 ?genusName .
 ?sp wdt:P171 ?genus . ?sp wdt:P105 wd:Q7432 . ?sp wdt:P225 ?spName .
 OPTIONAL { ?sp rdfs:label ?label FILTER(lang(?label)="en") }
 OPTIONAL { ?sp wdt:P1843 ?cn FILTER(lang(?cn)="en") }
 OPTIONAL { ?sp wdt:P141 ?st }
 FILTER(BOUND(?cn) || (BOUND(?label) && LCASE(STR(?label)) != LCASE(?spName)))
} GROUP BY ?sp ?spName ?genus ?genusName ?label"""
for name,q in [a.split("=") for a in sys.argv[1:]]:
    t=time.time()
    try: rows=ql(Q%q)
    except Exception as e: print(name,"ERR",e,flush=True); continue
    gs={r["genus"]:r["genusName"] for r in rows}
    json.dump({"genera":[{"genus":k,"genusName":v} for k,v in gs.items()],"species":rows},open(f"raw_{name}.json","w",encoding="utf-8"),ensure_ascii=False)
    print(name,"species",len(rows),"genera",len(gs),round(time.time()-t),"s",flush=True)
