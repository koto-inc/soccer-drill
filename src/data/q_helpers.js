/* ---- 問題データ用の省略記法 ---- */
// pl(t,x,y,l,opts): 選手。t='me'|'us'|'them'|'gk-us'|'gk-them'、l=ラベル（FW/MF/DF）。opts に face(x,y) を渡すと「体の向き」を描く
const pl=(t,x,y,l,o)=>Object.assign({t,x,y,l},o||{});
// face(x,y): 体の向き（その選手が向いている先の座標）。pl の5つ目に渡す（例: pl('me',34,36,'MF',face(34,10))）。
//            解答図（options[].a）では face:[x,y] と書くと「きみ」の正しい向きを黄色の扇で描く（movers で動かしたあとの位置に描く）
const face=(x,y)=>({face:[x,y]});
const GKT={t:'gk-them',x:34,y:2.5};
const GKU={t:'gk-us',x:34,y:2.5};
const back4=(t,y,dy)=>[pl(t,16,y,'DF'),pl(t,28,y+(dy||0),'DF'),pl(t,40,y+(dy||0),'DF'),pl(t,52,y,'DF')];
const pairs=a=>{const r=[];for(let i=0;i<a.length;i+=2)r.push([a[i],a[i+1]]);return r;};
const run=(...a)=>({kind:'run',pts:pairs(a)});      // 走る（黄色の実線）
const pass=(...a)=>({kind:'pass',pts:pairs(a)});    // パス（白の破線）
const drib=(...a)=>({kind:'dribble',pts:pairs(a)}); // ドリブル（白の点線）
const look=(...a)=>({kind:'look',pts:pairs(a)});    // 見る（細い黄色の破線）
// touch(x1,y1,x2,y2): ファーストタッチの方向（短く太い白の矢印、先にボール）。足の指定は選択肢の文章で表す
const touch=(...a)=>({kind:'touch',pts:pairs(a)});
const zone=(x,y,rx,ry,l)=>({x,y,rx,ry,l});
const lab=(x,y,t)=>({x,y,t});
const mv=(from,to)=>({from,to});
const O=(text,ok,why,a)=>({text,ok,why,a});
const Q=(level,phase,pos,situ,title,q,scene,options,point)=>({level,phase,pos,situ,title,q,scene,options,point});
const sc=(view,ball,players,arrows)=>({view,ball:{x:ball[0],y:ball[1]},players,arrows});
