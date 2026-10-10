"""Original ARQORA vector artwork. Scroll-scrubbed, never autoplays."""
import json
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]/'client-remodel-samples/public/renovation-workers.json'
def prop(v):return {'a':0,'k':v}
def keys(values):
 out=[]
 for n,(t,v) in enumerate(values):
  v=v if isinstance(v,list) else [v]
  d={'t':t,'s':v}
  if n<len(values)-1:d.update(e=values[n+1][1] if isinstance(values[n+1][1],list) else [values[n+1][1]],o={'x':[.33],'y':[.33]},i={'x':[.67],'y':[.67]})
  out.append(d)
 return {'a':1,'k':out}
def color(hex):return [int(hex[n:n+2],16)/255 for n in (0,2,4)]+[1]
ink=color('243b37');gold=color('cfb48c');cream=color('f2e8d4');skin=color('d8b396')
def trans(p=[0,0],a=[0,0],r=0,s=[100,100],o=100):return {'ty':'tr','p':prop(p),'a':prop(a),'r':r if isinstance(r,dict) else prop(r),'s':prop(s),'o':o if isinstance(o,dict) else prop(o),'sk':prop(0),'sa':prop(0)}
def path(points,closed=False):return {'ty':'sh','ks':prop({'i':[[0,0]]*len(points),'o':[[0,0]]*len(points),'v':points,'c':closed}),'d':1}
def stroke(c,w=2):return {'ty':'st','c':prop(c),'o':prop(100),'w':prop(w),'lc':2,'lj':2}
def fill(c):return {'ty':'fl','c':prop(c),'o':prop(100),'r':1}
def group(name,items,tr=None):return {'ty':'gr','nm':name,'it':items+[tr or trans()]}
def poly(name,points,c=ink,w=2,solid=None):return group(name,[path(points,solid is not None)]+([fill(solid)] if solid else [])+[stroke(c,w)])
def ellipse(name,p,s,c,outline=None):return group(name,[{'ty':'el','p':prop(p),'s':prop(s),'d':1},fill(c)]+([stroke(outline,1.5)] if outline else []))
def rect(name,p,s,c,r=2):return group(name,[{'ty':'rc','p':prop(p),'s':prop(s),'r':prop(r),'d':1},fill(c)])
layers=[]
def layer(name,shapes,p=[0,0,0],opacity=100,ip=0,op=240):
 layers.append({'ddd':0,'ind':len(layers)+1,'ty':4,'nm':name,'sr':1,'ks':{'o':opacity if isinstance(opacity,dict) else prop(opacity),'r':prop(0),'p':p if isinstance(p,dict) else prop(p),'a':prop([0,0,0]),'s':prop([100,100,100])},'shapes':shapes,'ip':ip,'op':op,'st':0,'bm':0})
# Painter: the roller travels with the articulated arm, rather than a detached icon.
rollerposes=[(0,-20),(139,-20)]+[(t,-50 if n%2==0 else 10) for n,t in enumerate(range(144,205,8))]+[(212,-20),(239,-20)]
painter=[
 poly('Boots',[[-12,96],[-12,128],[-23,128],[-5,128],[-2,98],[12,126],[24,126]],ink,7),
 poly('Trousers',[[-12,63],[-12,96],[-2,98],[13,94],[12,63]],ink,3,ink),
 poly('Work shirt',[[-16,15],[11,15],[17,62],[-17,62]],cream,1.5,ink),
 rect('Apron',[0,46],[22,42],gold,2),
 poly('Apron seams',[[-7,31],[-7,57],[6,57],[6,31]],ink,1.3),
 poly('Resting arm',[[-14,20],[-28,44],[-19,64]],cream,9),
 ellipse('Left hand',[-19,64],[8,9],skin),
 group('Painting arm',[poly('Sleeve',[[11,20],[26,32]],cream,10),poly('Forearm',[[26,32],[44,20]],skin,8),poly('Roller handle',[[44,20],[50,-2],[68,-2],[68,-25]],cream,3),rect('Roller',[68,-31],[32,13],gold,4)],trans(a=[11,20],p=[11,20],r=keys(rollerposes))),
 rect('Neck',[0,9],[10,12],skin,2),ellipse('Face',[0,-2],[23,29],skin,ink),
 poly('Profile',[[10,-1],[13,4],[8,6]],ink,1.4),
 ellipse('Helmet crown',[0,-14],[30,18],gold,ink),rect('Helmet brim',[1,-7],[37,5],cream,1),poly('Helmet seam',[[0,-20],[0,-10]],ink,1.4)
]
layer('Painter / finishing strokes',painter,p=[681,269,0],opacity=keys([(0,0),(129,0),(140,100),(198,100),(214,0),(239,0)]))
# The joiner enters, measures, then works at the island before walking out.
armposes=[(0,-12),(24,-12),(36,-40),(45,-8),(53,-35),(63,-8),(75,-20)]+[(t,10 if n%2 else -25) for n,t in enumerate(range(88,150,7))]+[(157,-10),(239,-10)]
legposes=[(0,0)]+[(t,12 if n%2 else -12) for n,t in enumerate(range(8,33,6))]+[(38,0),(76,0),(84,9),(92,-9),(100,0),(149,0),(158,12),(166,-12),(174,12),(184,0),(239,0)]
joiner=[
 group('Rear leg',[poly('Leg',[[8,60],[13,95],[10,127]],ink,10),poly('Boot',[[10,127],[23,127]],cream,7)],trans(a=[8,60],p=[8,60],r=keys(legposes))),
 group('Front leg',[poly('Leg',[[-8,60],[-12,95],[-12,127]],ink,11),poly('Boot',[[-12,127],[-1,127]],cream,7)],trans(a=[-8,60],p=[-8,60],r=keys([(t,-v) for t,v in legposes]))),
 poly('Torso',[[-17,16],[14,16],[17,62],[-17,62]],cream,1.5,ink),
 rect('Vest',[0,39],[27,40],gold,3),poly('Vest stitching',[[0,20],[0,59],[-11,45],[11,45]],ink,1.5),
 rect('Tool belt',[0,61],[38,7],cream,1),rect('Tool pouch',[-10,71],[13,16],gold,2),
 poly('Rear arm',[[-16,23],[-26,43],[-20,61]],cream,10),ellipse('Hand',[-20,61],[8,9],skin),
 group('Working arm',[poly('Upper arm',[[14,21],[32,29]],cream,10),poly('Forearm',[[32,29],[49,17]],skin,8),ellipse('Grip',[49,17],[8,9],skin),rect('Drill body',[56,12],[24,12],gold,2),rect('Drill handle',[49,23],[7,14],ink,1),poly('Drill bit',[[68,12],[82,12]],cream,2)],trans(a=[14,21],p=[14,21],r=keys(armposes))),
 rect('Neck',[0,9],[10,12],skin,2),ellipse('Head',[0,-3],[23,28],skin,ink),
 poly('Face',[[10,-4],[13,2],[8,5]],ink,1.4),ellipse('Helmet crown',[0,-15],[30,18],gold,ink),rect('Helmet brim',[2,-8],[37,5],cream,1),poly('Helmet seam',[[0,-21],[0,-11]],ink,1.5)
]
layer('Joiner / measuring and installation',joiner,p=keys([(0,[-60,272,0]),(32,[258,272,0]),(75,[258,272,0]),(101,[436,272,0]),(151,[436,272,0]),(186,[965,272,0]),(239,[965,272,0])]),opacity=keys([(0,0),(8,100),(178,100),(190,0),(239,0)]))
# The drawing is built piece by piece. Lines stay behind the workers.
layer('Ladder',[poly('Rails',[[646,401],[666,251],[704,251],[724,401]],gold,3),* [poly('Rung '+str(y),[[654+(401-y)*.133,y],[716-(401-y)*.133,y]],cream,2) for y in [375,349,323,297,271]]],opacity=keys([(0,0),(130,0),(142,80),(199,80),(214,0),(239,0)]))
layer('Tools',[rect('Toolbox',[358,394],[48,24],ink,3),poly('Box handle',[[347,382],[347,375],[370,375],[370,382]],gold,3),rect('Case trim',[358,391],[48,3],gold,0)],opacity=keys([(0,0),(24,0),(35,100),(158,100),(180,0),(239,0)]))
# Cabinet parts lift into their planned positions at consecutive moments.
for n,x in enumerate([443,514,585,656]):
 layer('Cabinet module '+str(n+1),[poly('Panel',[[0,0],[61,0],[61,87],[0,87]],gold,1.8),poly('Panel detail',[[7,7],[54,7],[54,80],[7,80]],cream,1),poly('Handle',[[47,30],[47,42]],gold,2)],p=keys([(0,[x,462,0]),(74+n*14,[x,462,0]),(89+n*14,[x,310,0]),(239,[x,310,0])]),opacity=keys([(0,0),(72+n*14,0),(80+n*14,75),(172,75),(204,0),(239,0)]))
layer('Countertop',[poly('Stone slab',[[428,0],[733,0],[733,14],[428,14]],cream,2,ink)],p=keys([(0,[0,248,0]),(118,[0,248,0]),(142,[0,292,0]),(239,[0,292,0])]),opacity=keys([(0,0),(111,0),(126,80),(174,80),(204,0),(239,0)]))
layer('Survey dimensions',[poly('Measure',[[100,65],[780,65]],gold,1),poly('Left tick',[[100,55],[100,75]],cream,1),poly('Right tick',[[780,55],[780,75]],cream,1)],opacity=keys([(0,0),(28,0),(40,85),(67,85),(82,0),(239,0)]))
# Soft ground shadows anchor the figures in the construction scene.
layer('Worker shadows',[ellipse('Joiner shadow',[443,404],[75,9],ink),ellipse('Painter shadow',[687,405],[70,9],ink)],opacity=keys([(0,0),(77,0),(98,30),(197,30),(215,0),(239,0)]))
# Lottie paints top-to-bottom: put workers above construction layers.
data={'v':'5.7.4','fr':30,'ip':0,'op':240,'w':900,'h':470,'nm':'ARQORA / A home in the making','ddd':0,'assets':[],'layers':layers,'markers':[{'tm':0,'cm':'The existing space','dr':36},{'tm':36,'cm':'Survey and design','dr':45},{'tm':81,'cm':'Craft and installation','dr':61},{'tm':142,'cm':'Finish and detail','dr':65},{'tm':207,'cm':'Welcome home','dr':33}]}
OUT.write_text(json.dumps(data,separators=(',',':')))
print(f'{OUT.name}: {len(layers)} layers, {OUT.stat().st_size} bytes')
