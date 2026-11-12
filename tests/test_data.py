import json,os,collections,sys
T=os.path.dirname(__file__);d=os.path.join(T,"..","data")
sys.path.insert(0,os.path.join(T,"..","collector"))
import collect_isa as c
A=json.load(open(d+"/athletes.json"));D=json.load(open(d+"/draft.json"))
def test_counts():
    assert len(D)==50 and sum(1 for a in A if a["manager"])==50
    cn=collections.Counter((a["manager"],a["division"]) for a in A if a["manager"])
    assert all(cn[(m,"men")]==3 and cn[(m,"women")]==2 for m in {x["manager"] for x in D})
def test_codes(): assert all(len(a["country"])==3 for a in A)
def tb(h,rows): return "<table><tr><td>%s</td><td>Pts</td></tr>"%h+"".join("<tr><td></td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"%r for r in rows)+"</table>"
def test_blocks():
    h=c.parse_results(tb("HEAT 1",[("A","PER","10,8",1),("B","CHN","6,2",2)])+tb("HEAT 2",[("C","USA","9",1)])+tb("HEAT 1",[("A","PER","11",1)]),"men")
    assert [(x["round"],x["heat"]) for x in h]==[("B01",1),("B01",2),("B02",1)] and h[0]["surfers"][0]["total"]==10.8
def test_live_waves():
    js={"category":"MEN","heat":"117","heatstatus":"RUNNING","minleft":8,"secleft":57,"CatDescr":"MEN - REPECHAGE 4 - HEAT 5","endofheat":"",
     "standings":"<div class='surfer'><div class='place' style='background-color:#0000FF'>1</div><div class='name'>G R</div><div class='priority'>P2</div><div class='score'>11.50</div><div class='info'>POR</div><div class='best'>6.17+5.33</div></div>",
     "scores":"<table><tr><td class='scorecol'><div class='head' style='background-color:#0000FF'>Avg</div><div class='avg topscore'>5.33</div><div class='jscores'><span>6.0</span><span>4.5</span><span>6.0</span><span>5.0</span><span>5.0</span></div><div class='avg topscore'>6.17</div><div class='jscores'><span>6.5</span></div></td></tr></table>"}
    l=c.parse_live(js)
    assert l["round"]=="REPECHAGE 4" and l["heat"]==5 and l["surfers"][0]["waves"]==[5.33,6.17] and l["surfers"][0]["priority"]=="P2"
