/* Grading engine — UMD so it can be unit-tested in Node and used in browser. */
(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory();}
  else{root.MLSGrade=factory();}
})(typeof self!=='undefined'?self:this,function(){
  "use strict";
  function normText(s){return String(s||'').toLowerCase().replace(/[\s，。、；：""''《》〈〉『』\[\]（）()！？!?,.;:]/g,'');}

  function judgeOne(q,val){
    if(val==null||val==='')return false;
    switch(q.qtype){
      case 'single':return val===q.answer;
      case 'multi':{
        var a=(typeof val==='string'?val:'').split('').sort().join('');
        var b=q.answer.split('').sort().join('');
        return a!==''&&a===b;
      }
      case 'judge':{
        var norm=String(val).replace(/[\s]/g,'');
        var yes=/^(对|正确|是|√|true|t|1|yes|y)$/i.test(norm);
        var no=/^(错|错误|否|×|x|false|f|0|no|n)$/i.test(norm);
        var key=/^(对|正确|是|√)/.test(q.answer)?'yes':'no';
        return (key==='yes')?yes:no;
      }
      case 'blank':{
        var v=normText(val);
        return (q.accepted||[q.answer]).some(function(a){return a&&(v===normText(a)||(v.length>=2&&normText(a).indexOf(v)>=0));});
      }
      case 'essay':{
        var text=normText(val);var groups=q.keywords||[];if(!groups.length)return false;
        var hit=0;
        groups.forEach(function(g){if(g.some(function(k){return k&&text.indexOf(normText(k))>=0;}))hit++;});
        return hit/groups.length>=0.7;
      }
    }
    return false;
  }
  return {judgeOne:judgeOne,normText:normText};
});
