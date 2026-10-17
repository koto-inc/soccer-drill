/* ポジショニングドリル：ブラウザ側の動き。
   ページはすべてビルド時に描画済み。ここでは
   - 限定公開ゲート（合言葉）
   - 問題ページ: 選択肢のタップ → 答え合わせ → 答え表示、「つぎの問題」の行き先、👍👎 フィードバック（押すまで次へ進めない）
   - TOP/カテゴリページ: 練習モード（カテゴリから1問ずつランダム）、◎○の印、最高記録
   - レベル別チャレンジ: 出題・タイム計測・採点・結果ページ
   だけを行う。設定は <head> の window.PD_CONFIG（build.mjs が書く）。 */
(function(){
  'use strict';
  var CFG=window.PD_CONFIG||{};
  var CH=CFG.challenge||{count:10,timeLimit:{},bands:[0,4,7,10],rankTable:{},msg:'つぎは{next}をねらおう！',msgTop:'パーフェクト！'};
  var RANKS=CFG.ranks||[];
  var LVN=CFG.levelNames||{1:'入門',2:'中級',3:'上級'};
  var KEYS=['ア','イ','ウ','エ','オ'];
  var BASE=CFG.base||'';
  var MARK={ok:'◎',partial:'○',ng:'×'};
  var SCORE={ok:1,partial:0.5,ng:0};

  function lsGet(k,def){ try{ var v=localStorage.getItem(k); return v==null?def:JSON.parse(v); }catch(e){ return def; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function ssGet(k){ try{ return JSON.parse(sessionStorage.getItem(k)||'null'); }catch(e){ return null; } }
  function ssSet(k,v){ try{ if(v==null) sessionStorage.removeItem(k); else sessionStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function qurl(id){ return BASE+'/q/'+String(id).padStart(3,'0')+'/'; }
  function shuffle(a){ for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;} return a; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function normalizePass(s){ return String(s).normalize('NFKC').toLowerCase().replace(/\s+/g,''); }
  function mmss(sec){ sec=Math.max(0,Math.round(sec)); return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); }
  function fmtScore(s){ return (Math.round(s*10)/10).toString(); }

  var solved=lsGet('pd-solved',{});

  /* ===== 限定公開ゲート ===== */
  function initGate(){
    var form=document.getElementById('gateForm');
    if(!form||!CFG.passcode) return;
    var input=document.getElementById('gateInput'), err=document.getElementById('gateErr');
    if(document.documentElement.classList.contains('locked')) setTimeout(function(){ input.focus(); },50);
    form.addEventListener('submit',function(ev){
      ev.preventDefault();
      if(normalizePass(input.value)===CFG.passcode){
        try{ localStorage.setItem('pd-pass',CFG.passcode); }catch(e){}
        document.documentElement.classList.remove('locked');
      }else{
        err.hidden=false; input.value=''; input.focus();
      }
    });
  }

  /* ===== ランク（レベル × 点数 × タイム） ===== */
  function bandIndex(score){ var b=CH.bands||[0]; var i=0; for(var k=0;k<b.length;k++){ if(score>=b[k]) i=k; } return i; }
  function rankOf(level,score,timeSec){
    var table=(CH.rankTable&&CH.rankTable[level])||[0,1,2,3];
    var idx=table[Math.min(bandIndex(score),table.length-1)];
    var limit=CH.timeLimit&&CH.timeLimit[level];
    var over=!!(limit&&timeSec>limit);
    if(over) idx=Math.max(idx-1,table[0]);
    var r=RANKS[idx]||{emoji:'',name:''};
    var next=RANKS[idx+1];
    var msg=next?String(CH.msg||'').replace('{next}',next.name):(CH.msgTop||'');
    return {idx:idx,emoji:r.emoji,name:r.name,msg:msg,over:over,limit:limit};
  }

  /* ===== レベル別チャレンジ（進行は sessionStorage 'pd-ch'） ===== */
  function startChallenge(level){
    var pool=(CFG.levels&&CFG.levels[level])||[];
    if(!pool.length) return;
    var ids=shuffle(pool.map(String)).slice(0,CH.count||10);
    ssSet('pd-ch',{level:level,ids:ids,results:[]});
    ssSet('pd-order',null);
    location.href=qurl(ids[0]);
  }
  function activeChallenge(){
    var ch=ssGet('pd-ch');
    return (ch&&ch.ids&&ch.results.length<ch.ids.length)?ch:null;
  }
  function bindStartButtons(root){
    (root||document).querySelectorAll('[data-start-challenge]').forEach(function(el){
      el.addEventListener('click',function(ev){ ev.preventDefault(); startChallenge(Number(el.getAttribute('data-start-challenge'))); });
    });
  }
  function showBest(root){
    var best=lsGet('pd-best',{});
    (root||document).querySelectorAll('[data-best]').forEach(function(el){
      var b=best[el.getAttribute('data-best')];
      if(!b) return;
      var r=RANKS[b.rank]||{emoji:'',name:''};
      el.textContent='ベストきろく: '+r.emoji+' '+r.name+' '+fmtScore(b.score)+'点 '+mmss(b.time);
      el.hidden=false;
    });
  }

  /* ===== TOP / カテゴリページ（練習モード） ===== */
  function initList(){
    document.querySelectorAll('.item[data-q]').forEach(function(el){
      var s=solved[el.getAttribute('data-q')];
      var mk=el.querySelector('.mk');
      if(mk) mk.textContent = s==='ok'?'◎':s?'○':'';
    });
    document.querySelectorAll('.cat[data-ids]').forEach(function(el){
      var ids=el.getAttribute('data-ids').split(',');
      var d=ids.filter(function(id){return solved[id]==='ok';}).length;
      var cn=el.querySelector('.cn');
      if(d&&cn&&!cn.querySelector('small')){ var sm=document.createElement('small'); sm.textContent='◎'+d; cn.appendChild(sm); }
      // カテゴリをタップ → その中からランダムに1問ずつ（未出題を出し切ったら最初に戻る）
      el.addEventListener('click',function(ev){
        ev.preventDefault();
        var order=shuffle(ids.slice());
        ssSet('pd-order',{label:el.getAttribute('data-label')||'',ids:order,cursor:0});
        ssSet('pd-ch',null);
        location.href=qurl(order[0]);
      });
    });
    var all=document.getElementById('doneAll');
    if(all){ var n=Object.keys(solved).filter(function(k){return solved[k]==='ok';}).length; all.textContent=String(n); }
    document.querySelectorAll('.item[data-q]').forEach(function(el){
      el.addEventListener('click',function(){
        var listEl=el.closest('[data-list-ids]');
        if(!listEl) return;
        var ids=shuffle(listEl.getAttribute('data-list-ids').split(','));
        var id=el.getAttribute('data-q');
        ids.splice(ids.indexOf(id),1); ids.unshift(id);
        ssSet('pd-order',{label:listEl.getAttribute('data-list-label')||'',ids:ids,cursor:0});
        ssSet('pd-ch',null);
      });
    });
    showBest();
  }

  /* ===== 👍👎 フィードバック（押すまで次へ進めない） ===== */
  function initFeedback(root,id,onVoted){
    var box=document.getElementById('feedback'); if(!box) return false;
    var all=lsGet('pd-fb',{});
    var done=document.getElementById('fbDone'), input=document.getElementById('fbComment');
    var btns=box.querySelectorAll('.fbv');
    function showDone(vote){
      btns.forEach(function(b){ b.classList.toggle('on',b.getAttribute('data-vote')===vote); });
      done.hidden=false;
    }
    if(all[id]) showDone(all[id].vote);
    btns.forEach(function(b){
      b.addEventListener('click',function(){
        var payload={qid:Number(id),vote:b.getAttribute('data-vote'),comment:(input.value||'').trim().slice(0,100),
          level:Number(root.getAttribute('data-level')),phase:root.getAttribute('data-phase'),pos:root.getAttribute('data-pos'),
          ua:navigator.userAgent,ts:new Date().toISOString()};
        all[id]=payload; lsSet('pd-fb',all);   // 1問につき1件（送り直しは上書き）
        if(CFG.feedback){
          try{ fetch(CFG.feedback,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)}).catch(function(){}); }catch(e){}
        }
        showDone(payload.vote);
        onVoted();
        if(window.gtag){ try{ gtag('event','feedback',{question_id:id,vote:payload.vote}); }catch(e){} }
      });
    });
    return !!all[id];   // すでに送ってあるか
  }

  /* ===== 問題ページ ===== */
  function initQuestion(root){
    var id=root.getAttribute('data-qid');
    var qview=document.getElementById('qview');
    var aview=document.getElementById('aview');
    var picked=[];
    var btnAnswer=document.getElementById('btnAnswer');
    var choices=root.querySelectorAll('.choice');
    var nextLinks=[].slice.call(document.querySelectorAll('#aview a[data-next]'));
    var skipLinks=document.querySelectorAll('a[data-skip]');
    var startedAt=Date.now();   // 問題を見はじめた時刻（タイム計測）
    var timerId=null;

    // チャレンジ中？
    var ch=activeChallenge(); var chPos=-1;
    if(ch){ chPos=ch.ids.indexOf(String(id)); if(chPos!==ch.results.length){ ch=null; chPos=-1; } }
    var nextId=null, isLast=false;
    if(ch){
      var spent=ch.results.reduce(function(s,r){return s+(r.time||0);},0);
      document.querySelectorAll('.catname').forEach(function(el){ el.textContent=LVN[ch.level]+'チャレンジ'; });
      var tick=function(){
        var t=spent+(Date.now()-startedAt)/1000;
        document.querySelectorAll('.qpos').forEach(function(el){ el.textContent=(chPos+1)+' / '+ch.ids.length+'　⏱ '+mmss(t); });
      };
      tick(); timerId=setInterval(tick,1000);
      skipLinks.forEach(function(a){ a.hidden=true; });
      isLast = chPos===ch.ids.length-1;
      nextId = isLast ? null : ch.ids[chPos+1];
      nextLinks.forEach(function(a){ a.href= isLast ? BASE+'/challenge/' : qurl(nextId); if(isLast) a.textContent='けっかを見る'; });
    }else{
      // 練習モード：TOPでえらんだカテゴリ順
      var order=ssGet('pd-order'); var pos=-1;
      if(order&&order.ids){ pos=order.ids.indexOf(String(id)); if(pos>=0){ order.cursor=pos; ssSet('pd-order',order); } }
      if(order&&pos>=0&&order.ids.length>1) nextId=order.ids[(pos+1)%order.ids.length];
      if(pos>=0){
        document.querySelectorAll('.catname').forEach(function(el){ el.textContent=order.label||'ランダム'; });
        document.querySelectorAll('.qpos').forEach(function(el){ el.textContent=(pos+1)+' 問目 / '+order.ids.length+' 問'; });
      }
      if(nextId){ nextLinks.forEach(function(a){ a.href=qurl(nextId); }); skipLinks.forEach(function(a){ a.href=qurl(nextId); }); }
    }

    // 👍👎 を押すまで「つぎの問題」は押せない
    function setNextEnabled(on){
      nextLinks.forEach(function(a){ a.classList.toggle('disabled',!on); a.setAttribute('aria-disabled',on?'false':'true'); if(on) a.removeAttribute('tabindex'); else a.setAttribute('tabindex','-1'); });
      var hint=document.getElementById('fbNeed'); if(hint) hint.hidden=on;
    }
    nextLinks.forEach(function(a){ a.addEventListener('click',function(ev){ if(a.classList.contains('disabled')){ ev.preventDefault(); var fb=document.getElementById('feedback'); if(fb){ fb.classList.add('shake'); setTimeout(function(){fb.classList.remove('shake');},500); fb.scrollIntoView({behavior:'smooth',block:'center'}); } } }); });
    var voted=initFeedback(root,id,function(){ setNextEnabled(true); });
    setNextEnabled(voted);

    choices.forEach(function(c){
      c.addEventListener('click',function(){
        var i=Number(c.getAttribute('data-i'));
        var at=picked.indexOf(i);
        if(at>=0){ picked.splice(at,1); c.setAttribute('aria-checked','false'); }
        else if(picked.length<3){ picked.push(i); c.setAttribute('aria-checked','true'); }
        btnAnswer.disabled=picked.length===0;
      });
    });

    btnAnswer.addEventListener('click',function(){
      var elapsed=(Date.now()-startedAt)/1000;
      if(timerId){ clearInterval(timerId); timerId=null; }
      var correct=[];
      choices.forEach(function(c){ if(c.getAttribute('data-ok')==='1') correct.push(Number(c.getAttribute('data-i'))); });
      var hit=picked.filter(function(i){return correct.indexOf(i)>=0;}).length;
      var miss=picked.length-hit;
      var cls,icon,msg,sub;
      var ck=correct.map(function(i){return KEYS[i];}).join('・');
      if(hit===correct.length&&miss===0){cls='ok';icon='◎';msg='せいかい！';sub='全部あてた！';}
      else if(hit>0){cls='partial';icon='○';msg='おしい！';sub='せいかいは '+ck+'。あたりは '+hit+' つ'+(miss?('、ちがうのが '+miss+' つ'):'')+'。';}
      else{cls='ng';icon='×';msg='ざんねん…';sub='せいかいは '+ck+'。もう一回考えてみよう。';}
      if(cls==='ok'||!solved[id]){ solved[id]=cls==='ok'?'ok':'tried'; lsSet('pd-solved',solved); }
      // チャレンジの採点とタイムを記録
      if(ch){
        var cur=ssGet('pd-ch');
        if(cur&&cur.results.length===chPos){ cur.results.push({id:id,title:root.getAttribute('data-title')||'',cls:cls,score:SCORE[cls],time:Math.round(elapsed*10)/10}); ssSet('pd-ch',cur); }
        document.querySelectorAll('.qpos').forEach(function(el){ el.textContent=(chPos+1)+' / '+ch.ids.length+'　⏱ '+mmss(spent+elapsed); });
      }
      var r=document.getElementById('result');
      r.className='result '+cls;
      r.innerHTML='<span class="big">'+icon+'</span><span>'+msg+'<small>'+sub+'</small></span>';
      aview.querySelectorAll('.ans').forEach(function(a){
        var i=Number(a.getAttribute('data-i'));
        var you=a.querySelector('.you'); if(you) you.hidden=picked.indexOf(i)<0;
      });
      qview.hidden=true; aview.hidden=false;
      window.scrollTo({top:0});
      if(window.gtag){ try{ gtag('event','answer',{question_id:id,result:cls}); }catch(e){} }
    });

    var retry=document.getElementById('btnRetry');
    if(retry) retry.addEventListener('click',function(){
      picked=[]; choices.forEach(function(c){ c.setAttribute('aria-checked','false'); });
      btnAnswer.disabled=true; aview.hidden=true; qview.hidden=false; window.scrollTo({top:0});
    });
    // チャレンジ中の「もう一回」は採点をやり直さない（最初の答えで決まる）ので隠す
    if(ch&&retry) retry.hidden=true;
  }

  /* ===== チャレンジ 結果ページ ===== */
  function initChallengePage(el){
    var ch=ssGet('pd-ch');
    bindStartButtons(el); showBest(el);
    if(!ch||!ch.ids||ch.results.length<ch.ids.length){
      // まだ終わっていない：途中なら「つづきから」を出す
      if(ch&&ch.ids&&ch.results.length>0){
        var lv=el.querySelector('#chLevels');
        if(lv) lv.insertAdjacentHTML('beforebegin','<p class="chcont"><a class="btn primary big" href="'+qurl(ch.ids[ch.results.length])+'">'+esc(LVN[ch.level])+'チャレンジのつづきから（'+(ch.results.length+1)+' / '+ch.ids.length+'）</a></p>');
      }
      return;
    }
    var level=ch.level;
    var total=ch.results.reduce(function(s,r){return s+r.score;},0);
    var time=ch.results.reduce(function(s,r){return s+(r.time||0);},0);
    var r=rankOf(level,total,time);
    var best=lsGet('pd-best',{});
    var prev=best[level];
    var isNew=!prev||total>prev.score||(total===prev.score&&time<prev.time);
    if(isNew){ best[level]={score:total,time:Math.round(time),rank:r.idx,ts:new Date().toISOString()}; lsSet('pd-best',best); }
    var timeLine = r.limit
      ? (r.over ? '<p class="chtime over">⏱ タイム '+mmss(time)+' ／ もくひょう '+mmss(r.limit)+'<br><b>もくひょうタイムをすぎたので、ランク1つダウン</b></p>'
                : '<p class="chtime ok">⏱ タイム '+mmss(time)+' ／ もくひょう '+mmss(r.limit)+'　<b>クリア！</b></p>')
      : '<p class="chtime">⏱ タイム '+mmss(time)+'</p>';
    var pr=prev?RANKS[prev.rank]||{name:''}:null;
    el.innerHTML=
      '<div class="card chres">'+
        '<div class="qno">'+esc(LVN[level])+'チャレンジ　けっか</div>'+
        '<div class="chscore">'+fmtScore(total)+' <small>/ '+ch.ids.length+'</small></div>'+
        timeLine+
        '<div class="chrank"><span class="chemoji">'+esc(r.emoji)+'</span><span class="chname">'+esc(r.name)+'</span></div>'+
        '<p class="chmsg">'+esc(r.msg)+'</p>'+
        (isNew?'<p class="chnew">🎉 '+esc(LVN[level])+'のベストきろく！</p>':'<p class="hint">'+esc(LVN[level])+'のベストきろく: '+esc(pr.name)+' '+fmtScore(prev.score)+'点 '+mmss(prev.time)+'</p>')+
      '</div>'+
      '<div class="card">'+
        '<p class="hint" style="margin-bottom:10px">◎=1点、○=0.5点、×=0点。タップすると、その問題をもう一度見られる。</p>'+
        '<div class="list">'+ch.results.map(function(x,i){
          return '<a class="item" href="'+qurl(x.id)+'"><span class="n"><span class="mk '+x.cls+'">'+MARK[x.cls]+'</span><br>'+(i+1)+'</span><span class="t">'+esc(x.title)+'<small>Q'+esc(x.id)+'・'+fmtScore(x.score)+'点・'+mmss(x.time||0)+'</small></span></a>';
        }).join('')+'</div>'+
      '</div>'+
      '<div class="actions"><button class="primary big" type="button" data-start-challenge="'+level+'">もう一度</button><button type="button" id="btnOtherLevel">べつのレベルをやる</button><a class="btn" href="'+BASE+'/">TOPへ</a></div>';
    bindStartButtons(el);
    document.getElementById('btnOtherLevel').addEventListener('click',function(){ ssSet('pd-ch',null); location.href=BASE+'/challenge/'; });
  }

  /* ===== サッカー用語（点線の下線）: タップで説明を出す ===== */
  function initTerms(){
    var open=null;   // いま出ている説明 {el, pop}
    function close(){ if(open){ open.el.classList.remove('open'); open.el.setAttribute('aria-expanded','false'); if(open.pop.parentNode) open.pop.parentNode.removeChild(open.pop); open=null; } }
    function toggle(el){
      if(open&&open.el===el){ close(); return; }
      close();
      var pop=document.createElement('span');
      pop.className='termpop'; pop.setAttribute('role','note');
      pop.textContent=(el.getAttribute('data-term')||'')+'：'+(el.getAttribute('data-d')||'');
      el.insertAdjacentElement('afterend',pop);
      el.classList.add('open'); el.setAttribute('aria-expanded','true');
      open={el:el,pop:pop};
    }
    document.addEventListener('click',function(ev){
      var t=ev.target.closest&&ev.target.closest('.term');
      if(t){ ev.preventDefault(); toggle(t); return; }
      if(open&&!(ev.target.closest&&ev.target.closest('.termpop'))) close();
    });
    document.addEventListener('keydown',function(ev){
      var t=ev.target.closest&&ev.target.closest('.term');
      if(t&&(ev.key==='Enter'||ev.key===' ')){ ev.preventDefault(); toggle(t); }
      else if(ev.key==='Escape') close();
    });
    document.querySelectorAll('.term').forEach(function(el){ el.setAttribute('aria-expanded','false'); });
  }

  initGate();
  initTerms();
  var qroot=document.querySelector('[data-qid]');
  var chPage=document.querySelector('[data-page="challenge"]');
  if(qroot) initQuestion(qroot);
  else if(chPage) initChallengePage(chPage);
  else { initList(); bindStartButtons(); }
})();
