// Hosted portfolio edition: only public GitHub reads, with review state local to the visitor.
type RecordValue = Record<string, any>;
const REPO = 'encode/httpx';
const KEY = 'fieldwork-hosted-reviews-v1';
let snapshot: RecordValue | null = null;
let current: RecordValue | null = null;
let runs: RecordValue[] = [];
try { runs = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { runs = []; }
const persist = () => localStorage.setItem(KEY, JSON.stringify(runs.slice(0, 30)));
const timestamp = () => new Date().toISOString();
async function initial() {
 if (!snapshot) snapshot = await fetch(new URL('snapshot.json', document.baseURI).href).then(r => { if(!r.ok) throw new Error('Public source snapshot unavailable.'); return r.json(); });
 if (!current) current = JSON.parse(JSON.stringify(snapshot));
 return current!;
}
async function github(path:string) {
 const r = await fetch('https://api.github.com/repos/'+REPO+path, {headers:{Accept:'application/vnd.github+json'}});
 if(!r.ok) throw new Error(r.status===403||r.status===429?'GitHub public rate limit reached. The captured public snapshot remains available.':'GitHub could not supply this record. Try again later.');
 return r.json();
}
const stop = new Set('the and for with from this that issue error using have has are was were you your not but can will what when then into about please'.split(' '));
function words(text:string):string[]{return [...new Set((text.toLowerCase().match(/[a-z][a-z0-9_]{2,}/g)||[]).filter(w=>!stop.has(w)))].slice(0,30);}
function evidence(issue:RecordValue, sources:RecordValue[]) {
 const terms = words(issue.title+' '+issue.body.slice(0,3500));
 return sources.filter(s=>s.issue_number!==issue.number).map((s):RecordValue=>{
   const body=(s.body||'').toLowerCase(),title=s.title.toLowerCase();
   const score=terms.reduce((n,t)=>n+(title.includes(t)?5:0)+(body.includes(t)?1:0),0);
   return {...s,score};
 }).filter(s=>s.score>0).sort((a,b)=>b.score-a.score).slice(0,6).map((s,i)=>{
   const paras=s.body.split('\n\n').filter(Boolean);
   const excerpt=paras.sort((a:string,b:string)=>terms.reduce((n,t)=>n+Number(b.toLowerCase().includes(t))-Number(a.toLowerCase().includes(t)),0))[0]||s.body;
   return {...s,id:'S'+(i+1),excerpt:excerpt.slice(0,1100)};
 });
}
function normalize(i:RecordValue){return {repo:REPO,number:i.number,title:i.title,body:i.body||'',url:i.html_url,state:i.state,labels:i.labels.map((l:RecordValue)=>l.name),author:i.user.login,updated_at:i.updated_at};}
async function sync() {
 const [meta,open,closed,readme,releases]=await Promise.all([github(''),github('/issues?state=open&per_page=50&sort=updated'),github('/issues?state=closed&per_page=50&sort=updated'),github('/readme'),github('/releases?per_page=8')]);
 const issues=[...open,...closed].filter(i=>!i.pull_request).map(normalize);
 const raw=Uint8Array.from(atob(readme.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
 const sources=[{kind:'documentation',title:'Repository README',body:new TextDecoder().decode(raw),url:readme.html_url,issue_number:null},
   ...releases.map((r:RecordValue)=>({kind:'release',title:r.name||r.tag_name,body:r.body||'',url:r.html_url,issue_number:null})),
   ...issues.map((i:RecordValue)=>({kind:i.state==='closed'?'historical issue':'related issue',title:i.title,body:i.body,url:i.url,issue_number:i.number}))].filter(s=>s.body.trim());
 current={repo:REPO,issues,sources,synced_at:timestamp(),description:meta.description};
 return {issues:issues.length,sources:sources.length,synced_at:current.synced_at};
}
async function investigate(number:number) {
 const data=await initial();
 const issue=data.issues.find((i:RecordValue)=>i.number===number);
 if(!issue) throw new Error('Select an imported issue first.');
 const started=performance.now();
 let liveIssue=issue,comments:RecordValue[]=[],sourceMode='Captured public snapshot';
 try {
  const [fresh,discussion]=await Promise.all([github('/issues/'+number),github('/issues/'+number+'/comments?per_page=30')]);
  liveIssue=normalize(fresh);comments=discussion;sourceMode='Live GitHub issue and comments';
 } catch { /* No invented live read: the result explicitly reports the snapshot fallback. */ }
 const fetchMs=Math.round(performance.now()-started), t=performance.now();
 const sources=evidence(liveIssue,data.sources), retrievalMs=Math.round(performance.now()-t);
 const draft=['Thanks for reporting this. These references may help a maintainer investigate; similarity does not establish the cause.',...sources.slice(0,3).map((s:RecordValue)=>`\n- [${s.title}](${s.url})`),'\n\nI cannot establish a verified cause or fix from these references alone. Please confirm the affected version, a minimal reproduction, and the expected versus observed behavior. Remove secrets from diagnostic output.'].join('');
 const id=crypto.randomUUID(), created=timestamp();
 const run={id,repo:REPO,number,status:'pending_review',draft,revision:1,error:'',published_url:'',created_at:created,updated_at:created,
  result:{mode:'retrieval',summary:liveIssue.title,findings:[],hypotheses:[],missing_information:['Affected version','Minimal reproduction','Expected versus observed behavior'],sources,usage:null,notice:`Hosted portfolio edition. ${sourceMode}${comments.length?' ('+comments.length+' comments)':''}. Browser-local lexical retrieval; no AI model, Python backend, or external write was called.`,issue_updated_at:liveIssue.updated_at},
  traces:[{id:1,step:'Read public source',duration_ms:fetchMs,detail:sourceMode+(comments.length?' and '+comments.length+' comments.':'.'),created_at:created},{id:2,step:'Find evidence',duration_ms:retrievalMs,detail:sources.length+' sources ranked in the browser by keyword overlap; this edition does not use the Python BM25 index.',created_at:created},{id:3,step:'Prepare response',duration_ms:0,detail:'Retrieval-only template. No diagnosis claimed, no model called.',created_at:created},{id:4,step:'Await review',duration_ms:0,detail:'Saved in this browser only. No GitHub publication available.',created_at:created}]};
 runs.unshift(run);persist();return {id};
}
export async function api<T>(path:string, body?:any):Promise<T> {
 const data=await initial(), url=new URL(path,'https://local.invalid'), id=url.pathname.split('/')[2];
 let value:any;
 if(body?.repo && body.repo!==REPO) throw new Error('This hosted demo is restricted to encode/httpx. Use the full Python project for other public repositories.');
 if(url.pathname==='/status') value={repositories:[{repo:REPO,synced_at:data.synced_at,issue_count:data.issues.length,source_count:data.sources.length,description:data.description}],default_repo:REPO,model_configured:false,model:null,github_authenticated:false,write_repo:null,webhook_configured:false};
 else if(url.pathname==='/sync') value=await sync();
 else if(url.pathname==='/issues') value={issues:[...data.issues].sort((a,b)=>b.updated_at.localeCompare(a.updated_at))};
 else if(url.pathname==='/investigations'&&body) value=await investigate(body.number);
 else if(url.pathname==='/investigations') value={investigations:runs};
 else if(url.pathname==='/metrics') {
  const completed=runs.filter(r=>r.status!=='failed');
  value={total:runs.length,pending:runs.filter(r=>r.status==='pending_review').length,approved:runs.filter(r=>r.status==='approved').length,published:0,failed:0,avg_duration_ms:Math.round(completed.reduce((n,r)=>n+r.traces.reduce((sum:number,t:RecordValue)=>sum+t.duration_ms,0),0)/(completed.length||1)),tokens:0,cost_usd:null,traces:runs.flatMap(r=>r.traces).reverse().slice(0,50),note:'Measured in this browser only. No model, cost estimate, saved-time claim, or external publication.'};
 } else if(url.pathname.endsWith('/publish')) throw new Error('External publication is disabled in the hosted demo.');
 else if(id) {
  const run=runs.find(r=>r.id===id);if(!run) throw new Error('Investigation not found in this browser.');
  if(url.pathname.endsWith('/review')) {
   if(!['pending_review','approved'].includes(run.status)||run.revision!==body.revision) throw new Error('This review is stale. Refresh the investigation.');
   if(!['approve','save','reject'].includes(body.decision)||!body.draft.trim()) throw new Error('Choose a valid decision and provide a response.');
   run.status=body.decision==='approve'?'approved':body.decision==='reject'?'rejected':'pending_review';run.draft=body.draft;run.revision++;run.updated_at=timestamp();
   run.traces.push({id:run.traces.length+1,step:'Local review',duration_ms:0,detail:'Visitor chose '+body.decision+'. Saved only in this browser; no comment posted.',created_at:timestamp()});persist();
  }
  value=run;
 } else throw new Error('Unsupported demo operation.');
 return JSON.parse(JSON.stringify(value));
}
