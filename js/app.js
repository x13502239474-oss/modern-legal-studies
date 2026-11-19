/* ============================================================
   MODERN LEGAL STUDIES — application logic
   Vanilla JS SPA, localStorage persistence, hash-free state nav.
   ============================================================ */
(function(){
"use strict";

var D = window.MLS_DATA || {map:{stages:[]},lessons:{},questions:{},cases:{},glossary:{},sectionOrder:[],sectionNames:{}};
var $app = document.getElementById('app');

/* ---------- persistent state ---------- */
var SK = 'mls_state_v1';
var state = load();
function defaultState(){return {
  done:{},            // lessonId -> true
  fav:{},             // lessonId -> true
  notes:[],           // {id,lessonId,lessonTitle,text,ts}
  answers:{},         // lessonId -> {order: {val,correct}}
  wrong:{},           // lessonId -> {order:{val,ts}}
  exam:{},            // stageId -> {score,total,ts}
  last:null,          // last lesson id
  progressScroll:{}   // lessonId -> ratio
};}
function load(){
  try{var raw=localStorage.getItem(SK);if(raw){var s=JSON.parse(raw);var d=defaultState();for(var k in d){if(!(k in s))s[k]=d[k];}return s;}}
  catch(e){}
  return defaultState();
}
function save(){try{localStorage.setItem(SK,JSON.stringify(state));}catch(e){}}

/* ---------- helpers ---------- */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function mdInline(s){
  // convert markdown links & bold & italics to html (content is trusted local data)
  return String(s||'')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/『(.+?)』/g,'<span class="q">『$1』</span>');
}
function allLessons(){
  var arr=[];
  D.map.stages.forEach(function(st){st.modules.forEach(function(m){m.lessons.forEach(function(l){
    arr.push({id:l.id,title:l.title,level:l.level,stageId:st.id,stageTitle:st.title,moduleId:m.id,moduleTitle:m.title,no:m.no});
  });});});
  return arr;
}
var LESSONS = allLessons();
function lessonById(id){for(var i=0;i<LESSONS.length;i++)if(LESSONS[i].id===id)return LESSONS[i];return null;}
function stageById(id){for(var i=0;i<D.map.stages.length;i++)if(D.map.stages[i].id===id)return D.map.stages[i];return null;}
function lessonIndex(id){for(var i=0;i<LESSONS.length;i++)if(LESSONS[i].id===id)return i;return -1;}
function toast(msg){
  var t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},1800);
}
function fmtDate(ts){var d=new Date(ts);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}

/* ---------- navigation ---------- */
var navStack=[];
var view={name:'home',param:null};
function go(name,param,opts){
  if(!opts||!opts.noStack){navStack.push(view);}
  view={name:name,param:param};
  if(name==='lesson'&&param){state.last=param;save();}
  setHash(name,param);
  render();window.scrollTo(0,0);
}
function back(){if(navStack.length){view=navStack.pop();}else{view={name:'home',param:null};}setHash(view.name,view.param);render();window.scrollTo(0,0);}

/* hash routing: keeps the current page across refresh, and makes links shareable.
   Static-host friendly — no server rewrite needed, works from file:// too. */
var PERSIST=['home','courses','lesson','quiz','cases','notes','profile','search','dict','exams'];
function setHash(name,param){
  if(PERSIST.indexOf(name)<0){return;}
  var h='#/'+name+(param?'/'+encodeURIComponent(param):'');
  if(location.hash!==h){try{history.replaceState(null,'',h);}catch(e){location.hash=h;}}
}
function parseHash(){
  var h=(location.hash||'').replace(/^#\/?/,'');
  if(!h){return null;}
  var parts=h.split('/');
  var name=decodeURIComponent(parts[0]);var param=parts[1]?decodeURIComponent(parts.slice(1).join('/')):null;
  if(PERSIST.indexOf(name)<0){return null;}
  if((name==='lesson'||name==='quiz')&&(!param||!lessonById(param))){return null;}
  return {name:name,param:param};
}

/* ---------- top bar ---------- */
function topbar(title,showBack){
  return '<header class="topbar">'+
    (showBack?'<button class="ico back" data-act="back" aria-label="返回">‹</button>':'')+
    '<div class="brand">MLS<small>MODERN LEGAL STUDIES</small></div>'+
    (title?'<div class="ttl">'+esc(title)+'</div>':'')+
    '<button class="ico" data-act="go-search" aria-label="搜索">⌕</button>'+
    '</header>';
}
function tabbar(active){
  var tabs=[['home','首页','⌂'],['courses','课程','▤'],['cases','案例','⚖'],['notes','笔记','✎'],['profile','我的','◉']];
  return '<nav class="tabbar">'+tabs.map(function(t){
    return '<button class="tab'+(active===t[0]?' active':'')+'" data-tab="'+t[0]+'"><span class="ti">'+t[2]+'</span>'+t[1]+'</button>';
  }).join('')+'</nav>';
}
function shell(active,title,showBack,body){
  $app.innerHTML=topbar(title,!!showBack)+body+tabbar(active);
}

/* ============================================================
   VIEW: HOME
   ============================================================ */
function renderHome(){
  var doneN=Object.keys(state.done).filter(function(k){return state.done[k];}).length;
  var pct=LESSONS.length?Math.round(doneN/LESSONS.length*100):0;
  var wrongN=Object.keys(state.wrong).reduce(function(a,k){return a+Object.keys(state.wrong[k]||{}).length;},0);
  var noteN=state.notes.length;
  var contHtml='';
  if(state.last&&lessonById(state.last)){
    var l=lessonById(state.last);
    contHtml='<div class="continue-card"><div class="between"><div><div class="small">继续学习</div>'+
      '<div style="font-weight:600;color:var(--walnut);margin-top:3px">'+esc(l.title)+'</div>'+
      '<div class="small" style="margin-top:2px">'+esc(l.stageTitle)+' · 模块'+l.no+'</div></div>'+
      '<button class="btn sm primary" data-act="open-lesson" data-id="'+l.id+'">继续</button></div></div>';
  }
  var stageCards=D.map.stages.map(function(st){
    var total=0;st.modules.forEach(function(m){total+=m.lessons.length;});
    var dn=0;st.modules.forEach(function(m){m.lessons.forEach(function(l){if(state.done[l.id])dn++;});});
    var p=total?Math.round(dn/total*100):0;
    return '<div class="stage-card s'+st.no+'" data-act="go-stage" data-id="'+st.id+'">'+
      '<div class="st-no">STAGE '+String(st.no).padStart(2,'0')+'</div>'+
      '<h3>'+esc(st.title)+'</h3><div class="st-en">'+esc(st.en)+'</div>'+
      '<p class="st-goal">'+esc(st.goal)+'</p>'+
      '<div class="st-meta"><span>'+st.modules.length+' 模块</span><span>'+total+' 知识点</span><span>'+p+'% 完成</span></div>'+
      '<div class="st-mini"><i style="width:'+p+'%"></i></div></div>';
  }).join('');

  var body='<div class="hero"><div class="sigil"><span>⚖</span></div>'+
    '<h1>MODERN LEGAL STUDIES</h1><div class="zh">当 代 法 学 系 统 学 习 平 台</div>'+
    '<p class="motto">『法者，治之端也。』——以三部经典为纲，系统研习法律思想与制度。</p></div>'+
    '<div class="progress-card"><div class="pc-top"><div><div class="small">总体学习进度</div>'+
    '<div class="pc-num">'+pct+'<small>%</small></div></div><div class="small">'+doneN+' / '+LESSONS.length+' 节</div></div>'+
    '<div class="pbar"><i style="width:'+pct+'%"></i></div>'+
    '<div class="pc-stats"><span>笔记 <b>'+noteN+'</b></span><span>错题 <b>'+wrongN+'</b></span><span>收藏 <b>'+Object.keys(state.fav).filter(function(k){return state.fav[k];}).length+'</b></span></div></div>'+
    contHtml+
    '<div class="section-head"><h2>学习阶段</h2><div class="ln"></div></div>'+
    stageCards+
    '<div style="height:10px"></div>';
  shell('home',null,false,body);
}

/* ============================================================
   VIEW: COURSES (catalog)
   ============================================================ */
function renderCourses(){
  var stageParam=view.param;
  var stages = stageParam?D.map.stages.filter(function(s){return s.id===stageParam;}):D.map.stages;
  var html='<div class="wrap" style="padding-bottom:8px"><div class="eyebrow">THE CURRICULUM</div>'+
    '<h2 style="font-family:var(--font-title);color:var(--walnut);font-size:20px;margin:6px 0 2px">课程体系</h2>'+
    '<p class="small">三阶段 · 十六模块 · '+LESSONS.length+' 个知识点，循序渐进，学完有体系。</p></div>';
  stages.forEach(function(st){
    html+='<div class="stage-block"><div class="stage-hd"><div class="no">'+String(st.no).padStart(2,'0')+'</div>'+
      '<div><h2>'+esc(st.title)+'</h2><p>'+esc(st.en)+'</p><p>'+esc(st.goal)+'</p></div></div>';
    st.modules.forEach(function(m,mi){
      var openId=view._open||null;
      var isOpen=(openId===m.id)||(!openId&&stageParam&&mi===0);
      var dn=m.lessons.filter(function(l){return state.done[l.id];}).length;
      html+='<div class="module'+(isOpen?' open':'')+'" data-mod="'+m.id+'">'+
        '<div class="mod-hd" data-act="toggle-mod" data-id="'+m.id+'"><div class="mno">'+String(m.no).padStart(2,'0')+'</div>'+
        '<div class="mtxt"><b>'+esc(m.title)+'</b><small>'+esc(m.en)+' · '+dn+'/'+m.lessons.length+' 已完成</small></div>'+
        '<div class="chev">▶</div></div><div class="mod-body">';
      m.lessons.forEach(function(l){
        html+='<div class="lesson-row'+(state.done[l.id]?' done':'')+'" data-act="open-lesson" data-id="'+l.id+'">'+
          '<div class="dot">'+(state.done[l.id]?'✓':'')+'</div>'+
          '<div class="lt"><b>'+esc(l.title)+'</b><small>'+(state.answers[l.id]?'已作答 · ':'')+'随堂测验 '+(D.questions[l.id]?D.questions[l.id].questions.length:0)+' 题</small></div>'+
          '<div class="lv '+l.level+'">'+levelName(l.level)+'</div></div>';
      });
      html+='</div></div>';
    });
    html+='</div>';
  });
  html+='<div style="height:8px"></div>';
  shell('courses',stageParam?stageById(stageParam).title:'课程',!!stageParam,html);
}
function levelName(lv){return {fundamental:'基础',core:'核心',debate:'争论',case:'案例'}[lv]||'基础';}

/* ============================================================
   VIEW: LESSON READER
   ============================================================ */
function renderLesson(){
  var id=view.param;var L=D.lessons[id];var meta=lessonById(id);
  if(!L||!meta){$app.innerHTML=topbar('未找到',true)+'<div class="empty">该知识点内容尚未加载。</div>'+tabbar('courses');return;}
  var secs=D.sectionOrder||Object.keys(L.sections);
  var bodyHtml='';
  secs.forEach(function(k){
    var txt=L.sections[k];if(!txt)return;
    var cls='sec '+k+'-sec';
    bodyHtml+='<section class="'+cls+'"><h2>'+esc(D.sectionNames[k]||k)+'</h2>'+
      textToHtml(txt)+'</section>';
  });
  var terms=(L.terms||[]).map(function(t){return '<span class="term-chip" data-act="term" data-term="'+esc(t.term)+'">'+esc(t.term)+'</span>';}).join('');
  var favOn=state.fav[id];
  var done=state.done[id];
  var qi=lessonIndex(id);
  var prev=qi>0?LESSONS[qi-1]:null, next=qi<LESSONS.length-1?LESSONS[qi+1]:null;
  var qcount=D.questions[id]?D.questions[id].questions.length:0;
  var answered=state.answers[id]?Object.keys(state.answers[id]).length:0;

  var html='<div class="reader"><div class="rh"><span class="eyebrow">STAGE '+meta.stageId.slice(1)+' · MODULE '+String(meta.no).padStart(2,'0')+' · '+levelName(meta.level)+'</span>'+
    '<h1>'+esc(L.title)+'</h1><div class="en">'+esc(L.en||'')+'</div>'+
    '<div class="tags">'+(L.tags||[]).split(',').filter(Boolean).map(function(t){return '<span class="tag">'+esc(t.trim())+'</span>';}).join('')+'</div></div>';
  if(terms)html+='<div class="terms"><h4>本节术语 · GLOSSARY</h4>'+terms+'</div>';
  html+=bodyHtml;
  if(L.source)html+='<div class="divider diamond"></div><p class="small">依据教材：'+esc(L.source)+'</p>';
  html+='<div class="reader-actions">'+
    '<button class="btn '+(done?'':'primary')+'" data-act="toggle-done" data-id="'+id+'">'+(done?'✓ 已标记学完':'标记本课学完')+'</button>'+
    '<button class="btn '+(favOn?'':'ghost')+'" data-act="toggle-fav" data-id="'+id+'">'+(favOn?'★ 已收藏':'☆ 收藏')+'</button>'+
    '<button class="btn ghost" data-act="add-note" data-id="'+id+'">✎ 写笔记</button></div>';
  html+='<button class="btn primary block" data-act="go-quiz" data-id="'+id+'">进入随堂测验（'+qcount+' 题'+(answered?' · 已答'+answered:'')+'）</button>';
  html+='<div class="reader-nav">'+
    (prev?'<button class="btn sm ghost" data-act="open-lesson" data-id="'+prev.id+'">‹ '+esc(prev.title)+'</button>':'<span></span>')+
    (next?'<button class="btn sm ghost" data-act="open-lesson" data-id="'+next.id+'">'+esc(next.title)+' ›</button>':'<span></span>')+
    '</div></div>';
  shell('courses',meta.title,true,html);
}
function textToHtml(txt){
  // split into paragraphs by blank line; keep list lines
  var blocks=txt.split(/\n{2,}/);
  return blocks.map(function(b){
    b=b.trim();if(!b)return '';
    if(/^\d+[\.、]/.test(b)){
      return '<ol>'+b.split(/\n+/).map(function(li){return '<li>'+mdInline(li.replace(/^\d+[\.、]\s*/,''))+'</li>';}).join('')+'</ol>';
    }
    if(/^[-•]/.test(b)){
      return '<ul>'+b.split(/\n+/).map(function(li){return '<li>'+mdInline(li.replace(/^[-•]\s*/,''))+'</li>';}).join('')+'</ul>';
    }
    return '<p>'+mdInline(b.replace(/\n+/g,'<br>'))+'</p>';
  }).join('');
}

/* ============================================================
   VIEW: QUIZ
   ============================================================ */
function renderQuiz(){
  var id=view.param;var q=D.questions[id];var meta=lessonById(id);
  if(!q||!meta){$app.innerHTML=topbar('测验',true)+'<div class="empty">题库尚未加载。</div>'+tabbar('courses');return;}
  var qs=q.questions;
  var ans=state.answers[id]||{};
  var submitted=!!view._submitted;
  var html='<div class="quiz-wrap"><div style="padding:16px 0 4px">'+
    '<div class="eyebrow">SELF ASSESSMENT</div><h2 style="font-family:var(--font-title);font-size:18px;color:var(--walnut);margin:6px 0 2px">'+esc(meta.title)+'</h2>'+
    '<p class="small">'+qs.length+' 道题 · 提交后逐题显示答案与详解 · 答错自动收入错题本</p></div>';
  qs.forEach(function(qs2,i){
    html+=renderQuestion(qs2,i,ans[qs2.order],submitted);
  });
  if(!submitted){
    html+='<div class="quiz-submit"><button class="btn primary block" data-act="submit-quiz" data-id="'+id+'">提交试卷</button></div>';
  }else{
    var correct=qs.filter(function(x){return ans[x.order]&&ans[x.order].correct;}).length;
    html+='<div class="result-card"><div class="score">'+correct+'<small> / '+qs.length+'</small></div>'+
      '<p class="small">答对 '+correct+' 题，正确率 '+Math.round(correct/qs.length*100)+'%</p>'+
      '<div class="row" style="justify-content:center;gap:10px;margin-top:12px">'+
      '<button class="btn" data-act="go-quiz" data-id="'+id+'">重新作答</button>'+
      '<button class="btn ghost" data-act="open-lesson" data-id="'+id+'">返回讲义</button></div></div>';
  }
  html+='</div>';
  shell('courses','随堂测验',true,html);
}
function renderQuestion(q,idx,ans,submitted,key){
  // key: unique DOM identifier within the current page (exam pools mix lessons)
  if(key==null)key=q.order;
  var qt={single:'单选题',multi:'多选题',judge:'判断题',blank:'填空题',essay:'论述题'}[q.qtype]||'题目';
  var h='<div class="q-card"><div class="q-head"><span class="q-num">Q'+(idx+1)+'</span><span class="q-type">'+qt+'</span></div>'+
    '<div class="q-stem">'+mdInline(q.stem)+'</div>';
  if(q.qtype==='single'||q.qtype==='multi'){
    var sel=ans?ans.val:null;
    (q.options||[]).forEach(function(op){
      var k=op.charAt(0);
      var cls='opt';
      if(submitted){
        var isRight=(q.qtype==='single')?(k===q.answer):(q.answer.indexOf(k)>=0);
        var isSel=(qtypeSel(sel,k));
        if(isRight)cls+=' right';else if(isSel)cls+=' wrong';
      }else if(sel&&qtypeSel(sel,k))cls+=' sel';
      h+='<div class="'+cls+'" data-act="pick" data-order="'+key+'" data-k="'+k+'" data-multi="'+(q.qtype==='multi')+'">'+
        '<span class="k">'+k+'</span><span>'+mdInline(op.slice(1).trim())+'</span></div>';
    });
  }else if(q.qtype==='judge'){
    ['对','错'].forEach(function(k){
      var cls='opt';
      if(submitted){var isRight=(k===q.answer);var isSel=(ans&&ans.val===k);if(isRight)cls+=' right';else if(isSel)cls+=' wrong';}
      else if(ans&&ans.val===k)cls+=' sel';
      h+='<div class="'+cls+'" data-act="pick" data-order="'+key+'" data-k="'+k+'" data-judge="1"><span class="k">'+(k==='对'?'✓':'✕')+'</span><span>'+k+'</span></div>';
    });
  }else if(q.qtype==='blank'){
    h+='<input class="q-input" type="text" data-input="'+key+'" placeholder="在此填写答案"'+
      ' value="'+(ans?esc(ans.val):'')+'"'+(submitted?' disabled':'')+'>';
  }else if(q.qtype==='essay'){
    h+='<textarea class="q-input" data-input="'+key+'" placeholder="写下你的论述，提交后对照要点">'+(ans?esc(ans.val):'')+'</textarea>'+
      (submitted?'':'<div class="small" style="margin-top:6px">提示：论述题按要点组判定覆盖率，请尽量写全各方面。</div>');
  }
  if(submitted&&q.explanation){
    h+='<div class="explain"><div class="ex-hd">详解与演示</div>'+mdInline(q.explanation)+'</div>';
  }
  h+='</div>';
  return h;
}
function qtypeSel(sel,k){if(sel==null)return false;if(typeof sel==='string')return sel.indexOf(k)>=0;return false;}

/* ---------- grading ---------- */
function grade(lessonId){
  var q=D.questions[lessonId];if(!q)return;
  var ans={};
  q.questions.forEach(function(x){
    var val=null;
    if(x.qtype==='single'||x.qtype==='multi'||x.qtype==='judge'){
      val=(state._pick&&state._pick[x.order]!=null)?state._pick[x.order]:null;
    }else{
      var inp=document.querySelector('[data-input="'+x.order+'"]');
      val=inp?inp.value.trim():'';
    }
    var correct=judgeOne(x,val);
    ans[x.order]={val:val,correct:correct};
    if(!correct){
      if(!state.wrong[lessonId])state.wrong[lessonId]={};
      state.wrong[lessonId][x.order]={val:val,ts:Date.now()};
    }else if(state.wrong[lessonId]&&state.wrong[lessonId][x.order]){
      delete state.wrong[lessonId][x.order];
      if(!Object.keys(state.wrong[lessonId]).length)delete state.wrong[lessonId];
    }
  });
  state.answers[lessonId]=ans;
  state._pick=null;
  save();
  view._submitted=true;
  render();window.scrollTo(0,0);
}
function judgeOne(q,val){return window.MLSGrade.judgeOne(q,val);}
function normText(s){return window.MLSGrade.normText(s);}

/* ============================================================
   VIEW: CASES
   ============================================================ */
function renderCases(){
  if(view.param){return renderCaseDetail(view.param);}
  var html='<div class="wrap"><div class="eyebrow">CASE STUDIES</div>'+
    '<h2 style="font-family:var(--font-title);font-size:20px;color:var(--walnut);margin:6px 0 2px">案例研究中心</h2>'+
    '<p class="small">从真实判决中理解法律如何运作。每个案例含背景、争议、依据、理由与理论意义。</p></div><div class="case-list">';
  D.map.cases.forEach(function(c){
    html+='<div class="case-card" data-act="open-case" data-id="'+c.id+'">'+
      '<div class="cc-top"><div><h3>'+esc(c.title)+'</h3><div class="zh">'+esc(c.zh)+'</div></div>'+
      '<span class="theme">'+esc(c.theme)+'</span></div>'+
      '<div class="meta"><span>⚖ '+esc(c.court)+'</span><span>'+c.year+'</span></div></div>';
  });
  html+='</div>';
  shell('cases',null,false,html);
}
function renderCaseDetail(id){
  var cs=D.cases[id];var c=null;D.map.cases.forEach(function(x){if(x.id===id)c=x;});
  if(!cs||!c){$app.innerHTML=topbar('案例',true)+'<div class="empty">案例内容尚未加载。</div>'+tabbar('cases');return;}
  var openSec=view._caseSec;
  var html='<div class="case-detail"><h1>'+esc(cs.title||c.title)+'</h1>'+
    '<div class="cd-meta">'+esc(cs.court||c.court)+' · '+esc(cs.year||c.year)+' · '+esc(cs.theme||c.theme)+'</div>';
  (cs.sections||[]).forEach(function(s,i){
    var open=(openSec===i)||(openSec==null&&i===0);
    html+='<section class="case-sec'+(open?' open':'')+'">'+
      '<button class="case-sec-hd" data-act="toggle-case-sec" data-i="'+i+'">'+
      '<span>'+esc(s.title)+'</span><span class="cs-chev">'+(open?'−':'+')+'</span></button>'+
      (open?'<div class="case-sec-body">'+textToHtml(s.body)+'</div>':'')+'</section>';
  });
  html+='<div class="divider diamond"></div>'+
    '<p class="small center">点击各节标题可展开／收起。判例事实依据权威判决，分析用中文重新组织。</p></div>';
  shell('cases',c.zh,true,html);
}

/* ============================================================
   VIEW: NOTES (notes + favorites)
   ============================================================ */
function renderNotes(){
  var tab=view._noteTab||'notes';
  var html='<div class="seg"><button class="'+(tab==='notes'?'active':'')+'" data-act="note-tab" data-tab="notes">我的笔记</button>'+
    '<button class="'+(tab==='fav'?'active':'')+'" data-act="note-tab" data-tab="fav">收藏知识点</button>'+
    '<button class="'+(tab==='wrong'?'active':'')+'" data-act="note-tab" data-tab="wrong">错题本</button></div>';
  if(tab==='notes'){
    var ns=state.notes.slice().sort(function(a,b){return b.ts-a.ts;});
    if(!ns.length)html+='<div class="empty"><span class="em-ico">✎</span>还没有笔记。<br>读课时点『写笔记』，把你的思考留下来。</div>';
    else ns.forEach(function(n){
      html+='<div class="list-item"><div class="li-h"><b>'+esc(n.lessonTitle)+'</b>'+
        '<button class="icon-btn" data-act="del-note" data-id="'+n.id+'">✕</button></div>'+
        '<div class="li-meta">'+fmtDate(n.ts)+'</div><div class="li-body">'+esc(n.text)+'</div>'+
        '<div class="li-act"><span data-act="open-lesson" data-id="'+n.lessonId+'">查看原文 ›</span></div></div>';
    });
  }else if(tab==='fav'){
    var fids=Object.keys(state.fav).filter(function(k){return state.fav[k];});
    if(!fids.length)html+='<div class="empty"><span class="em-ico">☆</span>还没有收藏。<br>在讲义页点『收藏』即可加入。</div>';
    else fids.forEach(function(id){var l=lessonById(id);if(!l)return;
      html+='<div class="list-item" data-act="open-lesson" data-id="'+id+'"><div class="li-h"><b>'+esc(l.title)+'</b><span class="icon-btn on">★</span></div>'+
        '<div class="li-meta">'+esc(l.stageTitle)+' · 模块'+l.no+'</div></div>';
    });
  }else{
    var wids=Object.keys(state.wrong);var any=false;
    wids.forEach(function(id){var l=lessonById(id);if(!l)return;
      var orders=Object.keys(state.wrong[id]);if(!orders.length)return;any=true;
      orders.forEach(function(o){
        var q=null;(D.questions[id]&&D.questions[id].questions||[]).forEach(function(x){if(String(x.order)===String(o))q=x;});
        html+='<div class="list-item"><div class="li-h"><b>'+esc(l.title)+' · 第'+(Number(o)+1)+'题</b></div>'+
          '<div class="li-meta">'+esc(q?q.qtype:'题目')+' · 答错于 '+fmtDate(state.wrong[id][o].ts)+'</div>'+
          (q?'<div class="li-body">'+mdInline(q.stem)+'</div>':'')+
          '<div class="li-act"><span data-act="redo" data-id="'+id+'">重做本题 ›</span></div></div>';
      });
    });
    if(!any)html+='<div class="empty"><span class="em-ico">✓</span>错题本为空。<br>保持得很好，或去随堂测验检验一下。</div>';
  }
  html+='<div style="height:10px"></div>';
  shell('notes',null,false,html);
}

/* ============================================================
   VIEW: PROFILE
   ============================================================ */
function renderProfile(){
  var doneN=Object.keys(state.done).filter(function(k){return state.done[k];}).length;
  var pct=LESSONS.length?Math.round(doneN/LESSONS.length*100):0;
  var qTotal=0,qAns=0,qCorrect=0;
  LESSONS.forEach(function(l){var qs=D.questions[l.id];if(!qs)return;qTotal+=qs.questions.length;
    var a=state.answers[l.id];if(a)Object.keys(a).forEach(function(k){qAns++;if(a[k].correct)qCorrect++;});});
  var wrongN=Object.keys(state.wrong).reduce(function(a,k){return a+Object.keys(state.wrong[k]||{}).length;},0);
  var html='<div class="profile-hero"><div class="avatar">⚖</div><h2>学习者</h2>'+
    '<p>法学修行者 · 自 '+fmtDate(Date.now())+'</p></div>'+
    '<div class="stat-grid">'+
    '<div class="stat-box"><div class="sv">'+pct+'%</div><div class="sl">课程完成率</div></div>'+
    '<div class="stat-box"><div class="sv">'+doneN+'</div><div class="sl">已学完知识点</div></div>'+
    '<div class="stat-box"><div class="sv">'+(qTotal?qCorrect+'/'+qTotal:'—')+'</div><div class="sl">答对 / 总题数</div></div>'+
    '<div class="stat-box"><div class="sv">'+wrongN+'</div><div class="sl">待攻克错题</div></div></div>'+
    '<div class="menu-list">'+
    '<div class="menu-row" data-act="go-search"><span class="mi">⌕</span><span class="ml">全局搜索</span><span class="mr">›</span></div>'+
    '<div class="menu-row" data-act="go-dict"><span class="mi">A</span><span class="ml">中英术语词典</span><span class="mr">'+Object.keys(D.glossary).length+' 条 ›</span></div>'+
    '<div class="menu-row" data-act="go-exams"><span class="mi">✦</span><span class="ml">阶段性考试</span><span class="mr">›</span></div>'+
    '<div class="menu-row" data-act="note-tab" data-tab="wrong"><span class="mi">✗</span><span class="ml">错题本</span><span class="mr">'+wrongN+' ›</span></div>'+
    '<div class="menu-row" data-act="show-about"><span class="mi">ⓘ</span><span class="ml">关于本平台</span><span class="mr">›</span></div>'+
    '<div class="menu-row" data-act="reset"><span class="mi">↺</span><span class="ml">重置全部学习数据</span><span class="mr">›</span></div>'+
    '</div><div style="height:12px"></div>';
  shell('profile',null,false,html);
}

/* ============================================================
   VIEW: SEARCH & DICTIONARY
   ============================================================ */
function renderSearch(){
  var q=view._q||'';
  var html='<div class="searchbar"><div class="sib"><input id="searchInput" type="search" placeholder="搜索知识点、术语、案例…" value="'+esc(q)+'"></div></div>';
  if(q.trim()){
    var kw=q.trim().toLowerCase();var res=[];
    LESSONS.forEach(function(l){var L=D.lessons[l.id];
      var hay=(l.title+' '+(L?L.title:'')+' '+(L?L.tags:'')+' '+Object.values(L&&L.sections||{}).join(' ')).toLowerCase();
      if(hay.indexOf(kw)>=0)res.push({type:'lesson',title:l.title,sub:l.stageTitle+' · 模块'+l.no,id:l.id});
    });
    D.map.cases.forEach(function(c){var raw=D.cases[c.id]||'';
      if((c.title+c.zh+c.theme+raw).toLowerCase().indexOf(kw)>=0)res.push({type:'case',title:c.title+' '+c.zh,sub:c.court+' · '+c.year,id:c.id});
    });
    Object.keys(D.glossary).forEach(function(t){var g=D.glossary[t];
      if((t+' '+g.def).toLowerCase().indexOf(kw)>=0)res.push({type:'term',title:t,sub:g.def,id:t});
    });
    html+='<div class="wrap"><div class="small">找到 '+res.length+' 条结果</div></div>';
    if(!res.length)html+='<div class="empty">没有找到相关内容，换个关键词试试。</div>';
    res.slice(0,60).forEach(function(r){
      var act=r.type==='lesson'?'open-lesson':(r.type==='case'?'open-case':'term');
      html+='<div class="list-item" data-act="'+act+'" data-id="'+esc(r.id)+'" data-term="'+esc(r.title)+'">'+
        '<div class="li-h"><b>'+esc(r.title)+'</b></div><div class="li-meta">'+esc(r.sub)+'</div></div>';
    });
  }else{
    html+='<div class="empty"><span class="em-ico">⌕</span>输入关键词，检索全部 '+LESSONS.length+' 个知识点、'+Object.keys(D.glossary).length+' 条术语与 '+D.map.cases.length+' 个判例。</div>';
  }
  shell('home',null,true,html);
  var inp=document.getElementById('searchInput');
  if(inp){inp.addEventListener('input',function(){
    view._q=this.value;
    var pos=this.selectionStart;renderSearch();
    var ni=document.getElementById('searchInput');if(ni){ni.focus();try{ni.setSelectionRange(pos,pos);}catch(e){}}
  });}
}
function renderDict(){
  var q=view._dq||'';
  var keys=Object.keys(D.glossary).filter(function(t){
    return !q||(t+' '+D.glossary[t].def).toLowerCase().indexOf(q.toLowerCase())>=0;
  }).sort(function(a,b){return a.localeCompare(b);});
  var html='<div class="searchbar"><div class="sib"><input id="dictInput" type="search" placeholder="检索中英术语…" value="'+esc(q)+'"></div></div>'+
    '<div class="small" style="padding:10px 16px 0">共 '+keys.length+' 条术语</div><div class="dict-list">';
  keys.forEach(function(t){var g=D.glossary[t];
    html+='<div class="dict-item"><span class="d-en">'+esc(t)+'</span><div class="d-def">'+esc(g.def)+'</div>'+
      (g.lesson?'<div class="d-src">见：'+esc((lessonById(g.lesson)||{}).title||g.lesson)+'</div>':'')+'</div>';
  });
  html+='</div>';
  shell('profile',null,true,html);
  var inp=document.getElementById('dictInput');
  if(inp)inp.addEventListener('input',function(){
    view._dq=this.value;var pos=this.selectionStart;renderDict();
    var ni=document.getElementById('dictInput');if(ni){ni.focus();try{ni.setSelectionRange(pos,pos);}catch(e){}}
  });
}

/* ============================================================
   VIEW: EXAMS
   ============================================================ */
function renderExams(){
  var html='<div class="exam-intro"><div class="eyebrow">STAGE EXAMINATION</div>'+
    '<h2 style="font-family:var(--font-title);font-size:20px;color:var(--walnut);margin:6px 0 8px">阶段性考试</h2>'+
    '<p class="small">每个阶段结束时，用一套综合题检验你的掌握程度。考试题目从该阶段各课题库中抽取。</p>';
  D.map.stages.forEach(function(st){
    var total=0;st.modules.forEach(function(m){m.lessons.forEach(function(l){var qs=D.questions[l.id];if(qs)total+=qs.questions.length;});});
    var r=state.exam[st.id];
    html+='<div class="ei-card"><h3>阶段 '+st.no+' · '+esc(st.title)+'</h3>'+
      '<p class="small">'+st.modules.length+' 模块 · 题库共 '+total+' 道 · 本次抽 20 题</p>'+
      (r?'<p class="small">上次成绩：'+r.score+' / '+r.total+'（'+fmtDate(r.ts)+'）</p>':'')+
      '<button class="btn primary sm" style="margin-top:12px" data-act="start-exam" data-id="'+st.id+'">开始考试</button></div>';
  });
  html+='</div>';
  shell('profile',null,true,html);
}
function startExam(stageId){
  var st=stageById(stageId);var pool=[];
  st.modules.forEach(function(m){m.lessons.forEach(function(l){var qs=D.questions[l.id];if(qs)qs.questions.forEach(function(q){pool.push({lid:l.id,q:q});});});});
  // deterministic shuffle by exam seed
  var seed=Date.now();function rnd(){seed=(seed*9301+49297)%233280;return seed/233280;}
  pool.sort(function(){return rnd()-0.5;});
  view._exam={stageId:stageId,pool:pool.slice(0,20),ans:{}};
  view.name='exam';render();window.scrollTo(0,0);
}
function renderExam(){
  var ex=view._exam;if(!ex){return renderExams();}
  var html='<div class="quiz-wrap"><div style="padding:16px 0 4px"><div class="eyebrow">EXAM · STAGE '+ex.stageId.slice(1)+'</div>'+
    '<h2 style="font-family:var(--font-title);font-size:18px;color:var(--walnut);margin:6px 0 2px">'+esc(stageById(ex.stageId).title)+'</h2>'+
    '<p class="small">共 '+ex.pool.length+' 题 · 交卷后显示成绩</p></div>';
  ex.pool.forEach(function(item,i){
    var q=item.q;
    html+=renderQuestion(q,i,null,false,i);
  });
  html+='<div class="quiz-submit"><button class="btn primary block" data-act="submit-exam">交卷并查看成绩</button></div></div>';
  shell('profile',null,true,html);
}
function submitExam(){
  var ex=view._exam;var correct=0;
  ex.pool.forEach(function(item,i){
    var q=item.q;var val=null;
    if(q.qtype==='single'||q.qtype==='multi'||q.qtype==='judge')val=(ex.ans[i]!=null)?ex.ans[i]:null;
    else{var inp=document.querySelector('[data-input="'+i+'"]');val=inp?inp.value.trim():'';}
    if(judgeOne(q,val))correct++;
  });
  state.exam[ex.stageId]={score:correct,total:ex.pool.length,ts:Date.now()};save();
  view._examResult={score:correct,total:ex.pool.length,stageId:ex.stageId};
  view.name='examResult';render();window.scrollTo(0,0);
}
function renderExamResult(){
  var r=view._examResult;
  var html='<div class="quiz-wrap"><div class="result-card" style="padding-top:40px">'+
    '<div class="eyebrow">EXAM COMPLETED</div><div class="score" style="margin-top:16px">'+r.score+'<small> / '+r.total+'</small></div>'+
    '<p class="small">正确率 '+Math.round(r.score/r.total*100)+'%</p>'+
    '<p class="small" style="margin-top:16px">'+(r.score/r.total>=0.8?'扎实。可以继续下一阶段了。':(r.score/r.total>=0.6?'基础尚稳，建议回看错题对应的讲义。':'建议重读本阶段讲义后再测一次。'))+'</p>'+
    '<div class="row" style="justify-content:center;gap:10px;margin-top:20px">'+
    '<button class="btn" data-act="go-exams">返回考试列表</button>'+
    '<button class="btn ghost" data-act="go-stage" data-id="'+r.stageId+'">复习本阶段</button></div></div></div>';
  shell('profile',null,true,html);
}

/* ============================================================
   MODALS
   ============================================================ */
function modal(html){
  var m=document.createElement('div');m.className='modal-mask';m.id='modalMask';
  m.innerHTML='<div class="modal">'+html+'</div>';
  m.addEventListener('click',function(e){if(e.target===m)closeModal();});
  document.body.appendChild(m);
}
function closeModal(){var m=document.getElementById('modalMask');if(m)m.parentNode.removeChild(m);}
function showNoteEditor(lessonId){
  var l=lessonById(lessonId);
  modal('<button class="m-close" data-act="close-modal">×</button><h3>写笔记 · '+esc(l.title)+'</h3>'+
    '<textarea id="noteText" placeholder="记下你的理解、疑问或联想…"></textarea>'+
    '<button class="btn primary block" style="margin-top:12px" data-act="save-note" data-id="'+lessonId+'">保存笔记</button>');
}
function showTerm(term){
  var g=D.glossary[term];
  var lines=[];
  // find definition variants from all lessons
  Object.keys(D.lessons).forEach(function(id){var L=D.lessons[id];(L.terms||[]).forEach(function(t){if(t.term===term&&lines.indexOf(t.def)<0)lines.push(t.def);});});
  var def=(g&&g.def)||lines[0]||'暂无释义。';
  modal('<button class="m-close" data-act="close-modal">×</button><h3>'+esc(term)+'</h3>'+
    '<p>'+esc(def)+'</p>'+(lines.length>1?'<div class="divider"></div><p class="small">其他语境：'+lines.map(esc).join('；')+'</p>':''));
}
function showAbout(){
  modal('<button class="m-close" data-act="close-modal">×</button><h3>关于本平台</h3>'+
    '<p>MODERN LEGAL STUDIES 是一套系统的个人法学课程，依据三部经典英文教材的知识体系编写：</p>'+
    '<p class="small">· Raymond Wacks, Understanding Jurisprudence (6th ed.)<br>'+
    '· Mathias Siems, Comparative Law (3rd ed.)<br>'+
    '· H. L. A. Hart, The Concept of Law (3rd ed.)</p>'+
    '<p class="small">课程由三阶段、十六模块、'+LESSONS.length+'个知识点构成。所有学习记录保存在本机浏览器中，刷新不丢失。内容用中文讲授，术语首次出现附英文原词。</p>'+
    '<p class="small">本平台供个人系统学习之用。</p>');
}

/* ============================================================
   EVENT DELEGATION
   ============================================================ */
document.addEventListener('click',function(e){
  var el=e.target.closest('[data-act],[data-tab]');
  if(!el)return;
  var tab=el.getAttribute('data-tab');
  // only bottom-nav .tab buttons navigate by data-tab; segmented controls
  // (note-tab) also carry data-tab but must be handled by their own case below
  if(tab&&el.classList.contains('tab')){go(tab);return;}
  var act=el.getAttribute('data-act');var id=el.getAttribute('data-id');
  switch(act){
    case 'back':back();break;
    case 'go-search':view._q='';go('search');break;
    case 'go-dict':view._dq='';go('dict');break;
    case 'go-exams':go('exams');break;
    case 'go-stage':view._open=null;go('courses',id);break;
    case 'open-lesson':go('lesson',id);break;
    case 'open-case':view._caseSec=null;go('cases',id);break;
    case 'toggle-case-sec':view._caseSec=(view._caseSec===Number(el.getAttribute('data-i')))?-1:Number(el.getAttribute('data-i'));render();break;
    case 'go-quiz':view._submitted=false;state._pick=null;go('quiz',id);break;
    case 'toggle-mod':{
      var mod=el.closest('.module');var open=mod.classList.toggle('open');view._open=open?mod.getAttribute('data-mod'):null;break;
    }
    case 'toggle-done':state.done[id]=!state.done[id];save();render();toast(state.done[id]?'已标记学完 ✓':'已取消标记');break;
    case 'toggle-fav':state.fav[id]=!state.fav[id];save();render();toast(state.fav[id]?'已收藏 ★':'已取消收藏');break;
    case 'add-note':showNoteEditor(id);break;
    case 'save-note':{
      var ta=document.getElementById('noteText');var txt=ta?ta.value.trim():'';
      if(!txt){toast('请先写下笔记内容');return;}
      var l=lessonById(id);
      state.notes.push({id:'n'+Date.now(),lessonId:id,lessonTitle:l?l.title:id,text:txt,ts:Date.now()});
      save();closeModal();toast('笔记已保存');render();break;
    }
    case 'del-note':{
      state.notes=state.notes.filter(function(n){return n.id!==id;});save();render();toast('笔记已删除');break;
    }
    case 'pick':{
      if(view.name!=='quiz'&&view.name!=='exam')return;
      var k=el.getAttribute('data-k');var order=el.getAttribute('data-order');
      // exam stores in view._exam.ans (unique index); quiz stores in state._pick
      var store=(view.name==='exam')?view._exam.ans:(state._pick||(state._pick={}));
      if(el.getAttribute('data-multi')){
        var cur=store[order]||'';
        store[order]=cur.indexOf(k)>=0?cur.replace(k,''):cur+k;
      }else{store[order]=k;}
      // update selection visuals without full render
      var card=el.closest('.q-card');
      card.querySelectorAll('.opt').forEach(function(o){
        var ok=o.getAttribute('data-k');var sel=false;
        var v=store[order]||'';sel=v.indexOf(ok)>=0;
        o.classList.toggle('sel',sel);
      });
      break;
    }
    case 'submit-quiz':grade(id);break;
    case 'submit-exam':submitExam();break;
    case 'start-exam':startExam(id);break;
    case 'note-tab':view._noteTab=el.getAttribute('data-tab');view.name='notes';render();break;
    case 'redo':{
      var q=null;var lid=id;var order=el.closest('.list-item').querySelector('.li-h b').textContent.match(/第(\d+)题/);
      go('quiz',lid);if(order)setTimeout(function(){var node=document.querySelectorAll('.q-card')[Number(order[1])-1];if(node)node.scrollIntoView({behavior:'smooth',block:'center'});},80);
      break;
    }
    case 'term':showTerm(el.getAttribute('data-term')||id);break;
    case 'close-modal':closeModal();break;
    case 'show-about':showAbout();break;
    case 'reset':{
      modal('<button class="m-close" data-act="close-modal">×</button><h3>重置学习数据</h3>'+
        '<p>这将清除全部进度、笔记、收藏与错题记录，且不可恢复。确定继续吗？</p>'+
        '<div class="row" style="gap:10px;margin-top:16px"><button class="btn ghost" data-act="close-modal">取消</button>'+
        '<button class="btn primary" data-act="confirm-reset">确定重置</button></div>');break;
    }
    case 'confirm-reset':state=defaultState();save();closeModal();go('home');toast('已重置');break;
  }
});

/* ---------- render dispatcher ---------- */
function render(){
  closeModal();
  switch(view.name){
    case 'home':renderHome();break;
    case 'courses':renderCourses();break;
    case 'lesson':renderLesson();break;
    case 'quiz':renderQuiz();break;
    case 'cases':renderCases();break;
    case 'notes':renderNotes();break;
    case 'profile':renderProfile();break;
    case 'search':renderSearch();break;
    case 'dict':renderDict();break;
    case 'exams':renderExams();break;
    case 'exam':renderExam();break;
    case 'examResult':renderExamResult();break;
    default:renderHome();
  }
}
/* restore the page from the URL so a refresh keeps you where you were */
var _restored=parseHash();
if(_restored){view=_restored;if(_restored.name==='lesson'){state.last=_restored.param;save();}}
render();
})();
