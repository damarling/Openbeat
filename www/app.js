const $=s=>document.querySelector(s);
const S={lib:JSON.parse(localStorage.lib||'[]'),cfg:JSON.parse(localStorage.cfg||'{}'),cache:JSON.parse(localStorage.ytc||'{}'),cur:0,q:[],i:-1,p:null};
const save=()=>{localStorage.lib=JSON.stringify(S.lib);localStorage.cfg=JSON.stringify(S.cfg);localStorage.ytc=JSON.stringify(S.cache)};
const J=async(u,t)=>{const r=await fetch(u,{headers:{Authorization:'Bearer '+t}});if(!r.ok)throw new Error(r.status+' '+u.split('?')[0]);return r.json()};

// ---------- UI ----------
function render(){
  $('#pls').innerHTML=S.lib.map((p,i)=>`<div class="pl ${i==S.cur?'sel':''}" onclick="S.cur=${i};render()">${esc(p.name)} <small>(${p.tracks.length})</small></div>`).join('')||'<p style="padding:12px;color:var(--mut)">Import a playlist to start.</p>';
  const p=S.lib[S.cur];
  $('#trs').innerHTML=p?p.tracks.map((t,i)=>`<div class="tr" onclick="play(${i})">${esc(t.title)}<small>${esc(t.artist)}</small></div>`).join(''):'';
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function saveSet(){S.cfg.spId=$('#spId').value.trim();S.cfg.gId=$('#gId').value.trim();save();$('#set').close()}
$('#spId').value=S.cfg.spId||'';$('#gId').value=S.cfg.gId||'';

// ---------- Spotify (OAuth PKCE, no secret needed) ----------
const REDIR=location.origin+'/';
async function spLogin(){
  const v=[...crypto.getRandomValues(new Uint8Array(64))].map(b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('');
  const ch=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  sessionStorage.v=v;
  location=`https://accounts.spotify.com/authorize?`+new URLSearchParams({client_id:S.cfg.spId,response_type:'code',redirect_uri:REDIR,scope:'playlist-read-private playlist-read-collaborative',code_challenge_method:'S256',code_challenge:ch});
}
async function spCallback(){
  const c=new URLSearchParams(location.search).get('code');if(!c)return;
  const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:S.cfg.spId,grant_type:'authorization_code',code:c,redirect_uri:REDIR,code_verifier:sessionStorage.v})});
  S.cfg.spTok=(await r.json()).access_token;save();history.replaceState({},'',REDIR);spImport();
}
async function spImport(){
  if(!S.cfg.spId)return $('#set').showModal();
  if(!S.cfg.spTok)return spLogin();
  try{
    const {items}=await J('https://api.spotify.com/v1/me/playlists?limit=50',S.cfg.spTok);
    for(const pl of items){
      let tracks=[],u=`https://api.spotify.com/v1/playlists/${pl.id}/tracks?limit=100`;
      while(u){const d=await J(u,S.cfg.spTok);
        tracks.push(...d.items.filter(x=>x.track).map(x=>({title:x.track.name,artist:x.track.artists.map(a=>a.name).join(', ')})));u=d.next}
      add('spotify:'+pl.id,'🟢 '+pl.name,tracks);
    }
  }catch(e){S.cfg.spTok=null;save();alert('Spotify import failed (token expired?). Tap import again. '+e.message)}
}
function add(id,name,tracks){S.lib=S.lib.filter(p=>p.id!=id);S.lib.push({id,name,tracks});save();render()}

// ---------- YouTube / YouTube Music (Google OAuth token flow) ----------
function ytLogin(){return new Promise(ok=>google.accounts.oauth2.initTokenClient({client_id:S.cfg.gId,scope:'https://www.googleapis.com/auth/youtube.readonly',callback:t=>{S.cfg.ytTok=t.access_token;save();ok()}}).requestAccessToken())}
async function ytImport(){
  if(!S.cfg.gId)return $('#set').showModal();
  if(!S.cfg.ytTok)await ytLogin();
  const A='https://www.googleapis.com/youtube/v3/';
  try{
    const {items}=await J(A+'playlists?part=snippet&mine=true&maxResults=50',S.cfg.ytTok);
    for(const pl of items){
      let tracks=[],tok='';
      do{const d=await J(A+`playlistItems?part=snippet&maxResults=50&playlistId=${pl.id}&pageToken=${tok}`,S.cfg.ytTok);
        tracks.push(...d.items.filter(x=>x.snippet.resourceId?.videoId&&x.snippet.title!='Deleted video').map(x=>({title:x.snippet.title,artist:(x.snippet.videoOwnerChannelTitle||'').replace(/ - Topic$/,''),vid:x.snippet.resourceId.videoId})));
        tok=d.nextPageToken||''}while(tok);
      add('yt:'+pl.id,'🔴 '+pl.snippet.title,tracks);
    }
  }catch(e){S.cfg.ytTok=null;save();alert('YouTube import failed (token expired?). Tap import again. '+e.message)}
}
async function resolve(t){ // Spotify tracks -> YouTube video (cached; search costs 100 API quota units)
  if(t.vid)return t.vid;
  const k=t.artist+' - '+t.title;if(S.cache[k])return S.cache[k];
  if(!S.cfg.ytTok)await ytLogin();
  const d=await J('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=1&q='+encodeURIComponent(k+' audio'),S.cfg.ytTok);
  return S.cache[k]=d.items[0]?.id.videoId;
}

// ---------- Player (official YouTube IFrame player) ----------
window.onYouTubeIframeAPIReady=()=>S.p=new YT.Player('yt',{height:'1',width:'1',playerVars:{playsinline:1},events:{onStateChange:e=>{
  $('#pp').textContent=e.data==1?'⏸':'▶';if(e.data==0)step(1)},onError:()=>step(1)}});
async function play(i){
  S.q=S.lib[S.cur].tracks;S.i=i;const t=S.q[i];$('#now').textContent=t.title+' — '+t.artist;
  try{const v=await resolve(t);if(!v)return step(1);save();S.p.loadVideoById(v)}catch(e){alert(e.message)}
  if('mediaSession'in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist});
    navigator.mediaSession.setActionHandler('nexttrack',()=>step(1));navigator.mediaSession.setActionHandler('previoustrack',()=>step(-1))}
}
const step=d=>{const n=S.i+d;if(n>=0&&n<S.q.length)play(n)};
const toggle=()=>S.p&&(S.p.getPlayerState()==1?S.p.pauseVideo():S.p.playVideo());
spCallback();render();
