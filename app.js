import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, increment,
  addDoc, query, orderBy, limit, limitToLast, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// ---------------- CONFIG ----------------
// KHÔNG còn lưu tài khoản/mật khẩu Admin trong code nữa.
// Đăng nhập Admin dùng Firebase Authentication (email/mật khẩu thật, không hiển thị ở client).
// Quyền admin được xác định bằng việc UID của người đăng nhập có tồn tại
// trong collection Firestore "admins" hay không (xem hướng dẫn thiết lập bên dưới).

const firebaseConfig = {
  apiKey: "AIzaSyAc_AJqiv0WX9FYOPCbDPR9nq8OWS0PkmE",
  authDomain: "vippro-3c3cb.firebaseapp.com",
  projectId: "vippro-3c3cb",
  storageBucket: "vippro-3c3cb.firebasestorage.app",
  messagingSenderId: "421125951716",
  appId: "1:421125951716:web:03e8f12c4569d10849dcf1",
  measurementId: "G-7N4C0D55CJ"
};
let db = null;
let auth = null;
let adminUnlocked = false; // cập nhật bởi onAuthStateChanged bên dưới, không lưu mật khẩu ở đây
try{
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}catch(e){
  console.error('Chưa cấu hình Firebase đúng cách:', e);
}

// Theo dõi phiên đăng nhập Firebase Auth. Khi có người đăng nhập, kiểm tra
// xem UID của họ có trong collection "admins" không -> nếu có thì mở quyền Admin.
// Việc đọc doc "admins/{uid}" chỉ được phép với chính UID đó (xem Firestore Rules đề xuất).
if(auth){
  onAuthStateChanged(auth, async (user)=>{
    if(user){
      try{
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        adminUnlocked = adminSnap.exists();
      }catch(e){
        adminUnlocked = false;
      }
      if(adminUnlocked){
        setCurrentUser({username: user.email, displayName: 'Quản trị viên'});
      }
    } else {
      adminUnlocked = false;
    }
    renderAuthUI();
    applyFiltersAndRender();
    renderCollectionChipsUI();
    renderDashboard();
  });
}

// ---------------- CLOUDINARY (lưu ảnh & nhạc) ----------------
const CLOUDINARY_CLOUD_NAME = "zi8ez10p";
const CLOUDINARY_UPLOAD_PRESET = "buivinhvip";

async function uploadToCloudinary(file){
  if(!file) throw new Error('Không có file để tải lên.');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
    method: 'POST',
    body: formData
  });
  if(!res.ok){
    const errText = await res.text();
    throw new Error('Cloudinary lỗi: ' + errText);
  }
  const data = await res.json();
  return data.secure_url;
}


// ---------------- HELPERS ----------------
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}
function switchView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
}
document.querySelectorAll('.tab-btn').forEach(b=>{
  b.addEventListener('click', ()=>switchView(b.dataset.view));
});

// ---------------- CHAT POPUP TOGGLE (kiểu Messenger) ----------------
function setChatOpen(open){
  const panel = document.getElementById('chatPanel');
  const btn = document.getElementById('chatToggleBtn');
  if(!panel || !btn) return;
  panel.classList.toggle('open', open);
  btn.classList.toggle('active', open);
  if(open){
    const wrap = document.getElementById('chatMessages');
    if(wrap){ wrap.scrollTop = wrap.scrollHeight; chatStickToBottom = true; }
  }
}
document.getElementById('chatToggleBtn').addEventListener('click', ()=>{
  const panel = document.getElementById('chatPanel');
  setChatOpen(!panel.classList.contains('open'));
});
document.getElementById('chatPopupCloseBtn').addEventListener('click', ()=>setChatOpen(false));

// ---------------- CHAT POPUP RESIZE (kéo góc trên-trái để chỉnh to/nhỏ) ----------------
(function initChatResize(){
  const panel = document.getElementById('chatPanel');
  const handle = document.getElementById('chatResizeHandle');
  if(!panel || !handle) return;

  let startX=0, startY=0, startW=0, startH=0, dragging=false;

  function clampSize(w,h){
    const minW = 280, minH = 320;
    const maxW = window.innerWidth - 24;
    const maxH = window.innerHeight - 24;
    return {
      w: Math.min(Math.max(w, minW), maxW),
      h: Math.min(Math.max(h, minH), maxH)
    };
  }

  function onMove(clientX, clientY){
    const dx = startX - clientX; // kéo sang trái -> rộng hơn
    const dy = startY - clientY; // kéo lên trên -> cao hơn
    const { w, h } = clampSize(startW + dx, startH + dy);
    panel.style.width = w + 'px';
    panel.style.height = h + 'px';
  }

  function stopDrag(){
    dragging = false;
    panel.classList.remove('resizing');
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', stopDrag);
  }
  function onMouseMove(e){ if(dragging) onMove(e.clientX, e.clientY); }
  function onMouseUp(){ stopDrag(); }
  function onTouchMove(e){
    if(!dragging) return;
    const t = e.touches[0];
    if(t){ onMove(t.clientX, t.clientY); e.preventDefault(); }
  }

  function startDrag(clientX, clientY){
    dragging = true;
    startX = clientX; startY = clientY;
    const rect = panel.getBoundingClientRect();
    startW = rect.width; startH = rect.height;
    panel.classList.add('resizing');
    document.body.style.userSelect = 'none';
  }

  handle.addEventListener('mousedown', (e)=>{
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
  handle.addEventListener('touchstart', (e)=>{
    const t = e.touches[0];
    if(!t) return;
    startDrag(t.clientX, t.clientY);
    window.addEventListener('touchmove', onTouchMove, {passive:false});
    window.addEventListener('touchend', stopDrag);
  }, {passive:true});
})();

// ---------------- MODAL CONFIRM / PROMPT (thay thế confirm()/prompt() gốc của trình duyệt) ----------------
function askConfirm({title='Xác nhận', message='Bạn có chắc chắn không?', okText='Đồng ý', danger=false} = {}){
  return new Promise(resolve=>{
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    const inputEl = document.getElementById('confirmInput');
    inputEl.style.display = 'none';
    const okBtn = document.getElementById('confirmOkBtn');
    okBtn.textContent = okText;
    okBtn.classList.toggle('danger', !!danger);
    overlay.classList.add('open');
    function cleanup(result){
      overlay.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      resolve(result);
    }
    function onOk(){ cleanup(true); }
    function onCancel(){ cleanup(false); }
    function onOverlay(e){ if(e.target.id==='confirmOverlay') cleanup(false); }
    const cancelBtn = document.getElementById('confirmCancelBtn');
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
  });
}
function askPrompt({title='Nhập thông tin', message='', placeholder='', okText='Xác nhận'} = {}){
  return new Promise(resolve=>{
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    const inputEl = document.getElementById('confirmInput');
    inputEl.style.display = 'block';
    inputEl.value = '';
    inputEl.placeholder = placeholder;
    const okBtn = document.getElementById('confirmOkBtn');
    okBtn.textContent = okText;
    okBtn.classList.remove('danger');
    overlay.classList.add('open');
    setTimeout(()=>inputEl.focus(), 60);
    function cleanup(result){
      overlay.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      inputEl.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk(){ cleanup(inputEl.value.trim() || null); }
    function onCancel(){ cleanup(null); }
    function onOverlay(e){ if(e.target.id==='confirmOverlay') cleanup(null); }
    function onKey(e){ if(e.key==='Enter') onOk(); if(e.key==='Escape') onCancel(); }
    const cancelBtn = document.getElementById('confirmCancelBtn');
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
    inputEl.addEventListener('keydown', onKey);
  });
}

// Nén ảnh và trả về CẢ preview (data URL, chỉ để xem trước) LẪN blob (để upload lên Cloudinary).
// Trước đây ảnh được lưu thẳng dạng base64 vào Firestore -> dễ vượt quá giới hạn 1MB/document
// của Firestore và bị lưu lỗi âm thầm, khiến ảnh "biến mất" sau khi upload.
function compressImageToBlob(file, maxW=700, quality=0.72){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const img = new Image();
      img.onload = ()=>{
        const scale = Math.min(1, maxW/img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width*scale;
        canvas.height = img.height*scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const previewUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(blob=>{
          if(blob) resolve({previewUrl, blob});
          else reject(new Error('Không tạo được ảnh nén.'));
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------- STORAGE (Firebase Firestore) ----------------
const PRODUCTS_CACHE_KEY = 'productsCacheV1';
const PRODUCTS_CACHE_TTL = 3 * 60 * 1000; // 3 phút

async function loadProducts(forceFresh){
  if(!db){ showToast('Chưa cấu hình Firebase — xem hướng dẫn trong file.'); return []; }
  if(!forceFresh){
    try{
      const raw = sessionStorage.getItem(PRODUCTS_CACHE_KEY);
      if(raw){
        const cached = JSON.parse(raw);
        if(cached && (Date.now() - cached.ts) < PRODUCTS_CACHE_TTL && Array.isArray(cached.list)){
          return cached.list;
        }
      }
    }catch(e){ /* bỏ qua lỗi cache, tải lại từ Firestore */ }
  }
  try{
    const snap = await getDocs(collection(db, 'products'));
    const list = snap.docs.map(d=>d.data());
    list.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    try{
      sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ts:Date.now(), list}));
    }catch(e){ /* sessionStorage đầy hoặc bị chặn, bỏ qua cache */ }
    return list;
  }catch(e){
    console.error(e);
    showToast('Không tải được sản phẩm, kiểm tra cấu hình Firebase.');
    return [];
  }
}
function invalidateProductsCache(){
  try{ sessionStorage.removeItem(PRODUCTS_CACHE_KEY); }catch(e){}
}
async function saveProductDoc(p){
  if(!db){ showToast('Chưa cấu hình Firebase — xem hướng dẫn trong file.'); return false; }
  try{
    await setDoc(doc(db,'products', p.id), p);
    invalidateProductsCache();
    return true;
  }catch(e){
    console.error(e);
    showToast('Lỗi lưu sản phẩm: ' + (e && e.message ? e.message : 'không rõ nguyên nhân'));
    return false;
  }
}
async function removeProductDoc(id){
  if(!db) return;
  try{ await deleteDoc(doc(db,'products', id)); invalidateProductsCache(); }
  catch(e){ console.error(e); showToast('Lỗi xoá sản phẩm.'); }
}
async function bumpProductStat(id, field){
  if(!db) return;
  try{
    await updateDoc(doc(db,'products', id), {[field]: increment(1)});
    invalidateProductsCache();
  }catch(e){
    // Nếu field chưa tồn tại trên document cũ, updateDoc vẫn tạo được nhờ increment(),
    // nhưng nếu document chưa từng có field này ở lần đầu, ta bỏ qua lỗi âm thầm để không làm phiền người dùng.
    console.warn('Không cập nhật được thống kê:', e);
  }
}
async function loadProfile(){
  if(!db) return null;
  try{
    const snap = await getDoc(doc(db,'site','profile'));
    return snap.exists() ? snap.data() : null;
  }catch(e){ console.error(e); return null; }
}
async function saveProfile(p){
  if(!db){ showToast('Chưa cấu hình Firebase — xem hướng dẫn trong file.'); return false; }
  try{
    await setDoc(doc(db,'site','profile'), p);
    return true;
  }catch(e){
    console.error(e);
    showToast('Lỗi lưu hồ sơ: ' + (e && e.message ? e.message : 'không rõ nguyên nhân'));
    return false;
  }
}
// ---------------- MÀN HÌNH GIỚI THIỆU (showcase carousel: ảnh + video) ----------------
async function loadShowcase(){
  if(!db) return [];
  try{
    const snap = await getDoc(doc(db,'site','showcase'));
    if(!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data.items) ? data.items : [];
  }catch(e){ console.error(e); return []; }
}
async function saveShowcase(items){
  if(!db){ showToast('Chưa cấu hình Firebase — xem hướng dẫn trong file.'); return false; }
  try{
    await setDoc(doc(db,'site','showcase'), {items});
    return true;
  }catch(e){
    console.error(e);
    showToast('Lỗi lưu màn hình giới thiệu: ' + (e && e.message ? e.message : 'không rõ nguyên nhân'));
    return false;
  }
}

async function loadPlaylist(){
  if(!db) return [];
  try{
    const snap = await getDocs(collection(db, 'playlist'));
    const list = snap.docs.map(d=>d.data());
    list.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    return list;
  }catch(e){
    console.error(e);
    return [];
  }
}
async function savePlaylistDoc(s){
  if(!db){ showToast('Chưa cấu hình Firebase — xem hướng dẫn trong file.'); return false; }
  try{
    await setDoc(doc(db,'playlist', s.id), s);
    return true;
  }catch(e){
    console.error(e);
    showToast('Lỗi lưu bài hát: ' + (e && e.message ? e.message : 'không rõ nguyên nhân'));
    return false;
  }
}
async function removePlaylistDoc(id){
  if(!db) return;
  try{ await deleteDoc(doc(db,'playlist', id)); }
  catch(e){ console.error(e); showToast('Lỗi xoá bài hát.'); }
}

// ---------------- LỊCH SỬ CHỈNH SỬA (Edit history / Undo) ----------------
// Lưu bản sao sản phẩm TRƯỚC khi sửa vào 1 collection riêng "productHistory",
// key theo id sản phẩm — chỉ giữ bản gần nhất trước lần sửa cuối để nhẹ dữ liệu.
async function saveProductHistorySnapshot(product){
  if(!db || !product) return;
  try{
    await setDoc(doc(db,'productHistory', product.id), {...product, savedAt: Date.now()});
  }catch(e){
    console.warn('Không lưu được lịch sử chỉnh sửa:', e);
  }
}
async function loadProductHistorySnapshot(id){
  if(!db) return null;
  try{
    const snap = await getDoc(doc(db,'productHistory', id));
    return snap.exists() ? snap.data() : null;
  }catch(e){ console.error(e); return null; }
}
async function removeProductHistorySnapshot(id){
  if(!db) return;
  try{ await deleteDoc(doc(db,'productHistory', id)); }catch(e){ /* bỏ qua */ }
}

// ---------------- BỘ SƯU TẬP (Collections) ----------------
async function loadCollections(){
  if(!db) return [];
  try{
    const snap = await getDocs(collection(db, 'collections'));
    const list = snap.docs.map(d=>d.data());
    list.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    return list;
  }catch(e){
    console.error(e);
    return [];
  }
}
async function saveCollectionDoc(c){
  if(!db){ showToast('Chưa cấu hình Firebase — xem hướng dẫn trong file.'); return false; }
  try{
    await setDoc(doc(db,'collections', c.id), c);
    return true;
  }catch(e){
    console.error(e);
    showToast('Lỗi lưu bộ sưu tập: ' + (e && e.message ? e.message : 'không rõ nguyên nhân'));
    return false;
  }
}
async function removeCollectionDoc(id){
  if(!db) return;
  try{ await deleteDoc(doc(db,'collections', id)); }
  catch(e){ console.error(e); showToast('Lỗi xoá bộ sưu tập.'); }
}

// ---------------- NGƯỜI DÙNG (User accounts - tách riêng với Admin) ----------------
// Lưu ý bảo mật: đây là ứng dụng chạy hoàn toàn phía client (không có backend riêng),
// nên mật khẩu được băm (hash) bằng SHA-256 kèm salt trước khi lưu lên Firestore,
// thay vì lưu thẳng dạng chữ thường (plain text). Đây KHÔNG phải là bảo mật cấp
// backend thực sự (ai có quyền đọc Firestore vẫn thấy được hash) — nếu cần an toàn
// cao hơn, bạn nên giới hạn quyền đọc collection "users" trong Firestore Rules.
async function hashPassword(password, salt){
  const enc = new TextEncoder();
  const data = enc.encode(salt + ':' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function normalizeUsername(u){
  return (u||'').trim().toLowerCase();
}
async function loadUserDoc(username){
  if(!db) return null;
  try{
    const snap = await getDoc(doc(db,'users', username));
    return snap.exists() ? snap.data() : null;
  }catch(e){ console.error(e); return null; }
}
async function saveUserDoc(u){
  if(!db){ showToast('Chưa cấu hình Firebase — xem hướng dẫn trong file.'); return false; }
  try{
    await setDoc(doc(db,'users', u.username), u);
    return true;
  }catch(e){
    console.error(e);
    showToast('Lỗi lưu tài khoản: ' + (e && e.message ? e.message : 'không rõ nguyên nhân'));
    return false;
  }
}

const CURRENT_USER_KEY = 'currentUserSession';
function getCurrentUser(){
  try{
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function setCurrentUser(u){
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
}
function clearCurrentUser(){
  localStorage.removeItem(CURRENT_USER_KEY);
}
function isUserLoggedIn(){
  return !!getCurrentUser();
}

// renderAuthUI() cập nhật giao diện của nút "loginBtn" duy nhất trên nav,
// phản ánh 1 trong 3 trạng thái: chưa đăng nhập / đã đăng nhập là khách hàng / đã đăng nhập là Admin.
function renderAuthUI(){
  const btn = document.getElementById('loginBtn');
  const admin = isAdminUnlocked();
  const cur = getCurrentUser();
  document.body.classList.toggle('admin-mode', admin);
  document.body.classList.toggle('user-mode', !admin && !!cur);
  document.body.classList.toggle('filemgr-mode', canUploadFiles());
  if(typeof renderShowcaseUI === 'function' && document.getElementById('showcaseSection')) renderShowcaseUI();
  if(typeof renderChatAccessUI === 'function' && document.getElementById('chatPanel')) renderChatAccessUI();
  if(typeof renderChatMessages === 'function' && document.getElementById('chatMessages')) renderChatMessages();
  if(admin){
    btn.textContent = '🔓 ' + (cur && cur.displayName ? cur.displayName : 'Admin') + ' · Thoát';
  } else if(cur){
    btn.textContent = '👤 ' + (cur.displayName || cur.username) + ' · Đăng xuất';
  } else {
    btn.textContent = '👤 Đăng nhập';
  }
  btn.title = btn.textContent;
  renderVcoinUI();
}

// Cập nhật hiển thị số dư V-coin trên header + trang hồ sơ (chỉ áp dụng cho khách hàng, không áp dụng cho Admin).
function renderVcoinUI(){
  const cur = getCurrentUser();
  const admin = isAdminUnlocked();
  const balance = (!admin && cur && typeof cur.vcoin === 'number') ? cur.vcoin : 0;
  const amountEl = document.getElementById('vcoinAmount');
  const profileAmountEl = document.getElementById('vcoinProfileAmount');
  if(amountEl) amountEl.textContent = balance;
  if(profileAmountEl) profileAmountEl.textContent = balance;
}

function openUserAuthModal(defaultTab){
  document.getElementById('userAuthOverlay').style.display = 'flex';
  switchAuthTab(defaultTab || 'login');
  document.getElementById('userLoginId').value = '';
  document.getElementById('userLoginPass').value = '';
  document.getElementById('userRegName').value = '';
  document.getElementById('userRegId').value = '';
  document.getElementById('userRegPass').value = '';
  document.getElementById('userLoginError').style.display = 'none';
  document.getElementById('userRegError').style.display = 'none';
}
function closeUserAuthModal(){
  document.getElementById('userAuthOverlay').style.display = 'none';
}
function switchAuthTab(tab){
  const isLogin = tab === 'login';
  document.getElementById('authTabLoginBtn').classList.toggle('active', isLogin);
  document.getElementById('authTabRegisterBtn').classList.toggle('active', !isLogin);
  document.getElementById('authFormLogin').classList.toggle('active', isLogin);
  document.getElementById('authFormRegister').classList.toggle('active', !isLogin);
}
document.getElementById('authTabLoginBtn').addEventListener('click', ()=>switchAuthTab('login'));
document.getElementById('authTabRegisterBtn').addEventListener('click', ()=>switchAuthTab('register'));
document.getElementById('closeUserAuthBtn').addEventListener('click', closeUserAuthModal);
document.getElementById('userAuthOverlay').addEventListener('click', e=>{
  if(e.target.id === 'userAuthOverlay') closeUserAuthModal();
});

async function submitUserRegister(){
  const errEl = document.getElementById('userRegError');
  errEl.style.display = 'none';
  const displayName = document.getElementById('userRegName').value.trim();
  const rawUsername = document.getElementById('userRegId').value.trim();
  const username = normalizeUsername(rawUsername);
  const password = document.getElementById('userRegPass').value;

  if(!displayName){ errEl.textContent = 'Vui lòng nhập tên hiển thị.'; errEl.style.display = 'block'; return; }
  if(!username || !/^[a-z0-9_.]{3,24}$/.test(username)){
    errEl.textContent = 'Tên đăng nhập cần 3-24 ký tự (chữ, số, _ hoặc .), không dấu.';
    errEl.style.display = 'block';
    return;
  }
  if(!password || password.length < 4){ errEl.textContent = 'Mật khẩu cần ít nhất 4 ký tự.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('submitUserRegBtn');
  btn.disabled = true;
  try{
    const existing = await loadUserDoc(username);
    if(existing){
      errEl.textContent = 'Tên đăng nhập này đã được sử dụng.';
      errEl.style.display = 'block';
      btn.disabled = false;
      return;
    }
    const salt = username + '_' + Date.now();
    const passwordHash = await hashPassword(password, salt);
    const userDoc = {
      username, displayName, salt, passwordHash,
      vcoin: 0,
      canManageFiles: false, // mặc định chưa có quyền upload/xoá file, Admin cấp riêng sau
      createdAt: Date.now()
    };
    const ok = await saveUserDoc(userDoc);
    btn.disabled = false;
    if(!ok) return;
    setCurrentUser({username, displayName, vcoin: 0, canManageFiles: false});
    renderAuthUI();
    closeUserAuthModal();
    showToast('Tạo tài khoản thành công! Chào mừng ' + displayName + '.');
    renderFavoritesUI();
  }catch(e){
    console.error(e);
    errEl.textContent = 'Có lỗi xảy ra, thử lại nhé.';
    errEl.style.display = 'block';
    btn.disabled = false;
  }
}
async function submitUserLogin(){
  const errEl = document.getElementById('userLoginError');
  errEl.style.display = 'none';
  const rawUsername = document.getElementById('userLoginId').value.trim();
  const password = document.getElementById('userLoginPass').value;
  if(!rawUsername || !password){
    errEl.textContent = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('submitUserLoginBtn');
  btn.disabled = true;

  // 1) Nếu ô "tên đăng nhập" là một địa chỉ email -> thử đăng nhập Admin qua
  //    Firebase Authentication thật (mật khẩu không hề nằm trong code hay Firestore ở dạng đọc được).
  if(rawUsername.includes('@')){
    try{
      const cred = await signInWithEmailAndPassword(auth, rawUsername, password);
      const adminSnap = await getDoc(doc(db, 'admins', cred.user.uid));
      if(adminSnap.exists()){
        adminUnlocked = true;
        setCurrentUser({username: cred.user.email, displayName: 'Quản trị viên'});
        renderAuthUI();
        closeUserAuthModal();
        btn.disabled = false;
        showToast('Đã đăng nhập với quyền Admin.');
        applyFiltersAndRender();
        renderCollectionChipsUI();
        renderDashboard();
        return;
      } else {
        // Email/mật khẩu đúng nhưng tài khoản này không có quyền admin.
        await signOut(auth);
        errEl.textContent = 'Tài khoản này không có quyền quản trị.';
        errEl.style.display = 'block';
        btn.disabled = false;
        return;
      }
    }catch(e){
      console.error('Lỗi đăng nhập Admin (Firebase Auth):', e.code, e.message);
      if(e.code === 'auth/operation-not-allowed'){
        errEl.textContent = 'Chưa bật đăng nhập Email/Password trong Firebase Console.';
      } else if(e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'){
        errEl.textContent = 'Sai email hoặc mật khẩu, hoặc tài khoản này chưa được tạo trong Firebase Authentication.';
      } else if(e.code === 'auth/unauthorized-domain'){
        errEl.textContent = 'Domain này chưa được thêm vào danh sách Authorized domains của Firebase Auth.';
      } else if(e.code === 'auth/too-many-requests'){
        errEl.textContent = 'Đăng nhập sai quá nhiều lần, Firebase tạm khoá. Vui lòng thử lại sau.';
      } else if(e.code === 'permission-denied' || e.code === 'firestore/permission-denied'){
        errEl.textContent = 'Đăng nhập đúng, nhưng Firestore Rules đang chặn đọc collection "admins". Xem hướng dẫn cập nhật Rules.';
      } else {
        errEl.textContent = 'Lỗi đăng nhập (' + (e.code || e.message) + '). Xem Console (F12) để biết chi tiết.';
      }
      errEl.style.display = 'block';
      btn.disabled = false;
      return;
    }
  }

  // 2) Không phải Admin -> kiểm tra trong danh sách tài khoản người dùng thường.
  const username = normalizeUsername(rawUsername);
  try{
    const userDoc = await loadUserDoc(username);
    if(!userDoc){
      errEl.textContent = 'Sai tên đăng nhập hoặc mật khẩu.';
      errEl.style.display = 'block';
      btn.disabled = false;
      return;
    }
    const checkHash = await hashPassword(password, userDoc.salt);
    if(checkHash !== userDoc.passwordHash){
      errEl.textContent = 'Sai tên đăng nhập hoặc mật khẩu.';
      errEl.style.display = 'block';
      btn.disabled = false;
      return;
    }
    setCurrentUser({username: userDoc.username, displayName: userDoc.displayName, vcoin: userDoc.vcoin||0, canManageFiles: !!userDoc.canManageFiles});
    renderAuthUI();
    closeUserAuthModal();
    btn.disabled = false;
    showToast('Đăng nhập thành công! Chào mừng trở lại, ' + userDoc.displayName + '.');
    renderFavoritesUI();
    applyFiltersAndRender();
  }catch(e){
    console.error(e);
    errEl.textContent = 'Có lỗi xảy ra, thử lại nhé.';
    errEl.style.display = 'block';
    btn.disabled = false;
  }
}
document.getElementById('submitUserRegBtn').addEventListener('click', submitUserRegister);
document.getElementById('submitUserLoginBtn').addEventListener('click', submitUserLogin);
document.getElementById('userLoginPass').addEventListener('keydown', e=>{ if(e.key==='Enter') submitUserLogin(); });
document.getElementById('userRegPass').addEventListener('keydown', e=>{ if(e.key==='Enter') submitUserRegister(); });

// ---------------- YÊU THÍCH (Favorites) ----------------
// Lưu theo từng user vào localStorage (khoá theo username) để đơn giản, không cần thêm collection Firestore.
function favKey(){
  const cur = getCurrentUser();
  return cur ? ('favorites_' + cur.username) : null;
}
function getFavorites(){
  const key = favKey();
  if(!key) return [];
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function setFavorites(list){
  const key = favKey();
  if(!key) return;
  localStorage.setItem(key, JSON.stringify(list));
}
function isFavorite(id){
  return getFavorites().includes(id);
}
window.toggleFavorite = function(id){
  if(!isUserLoggedIn()){
    showToast('Vui lòng đăng nhập để lưu yêu thích.');
    openUserAuthModal('login');
    return;
  }
  let favs = getFavorites();
  if(favs.includes(id)){
    favs = favs.filter(x=>x!==id);
    showToast('Đã bỏ yêu thích.');
  } else {
    favs.push(id);
    showToast('Đã thêm vào yêu thích ♥');
  }
  setFavorites(favs);
  applyFiltersAndRender();
  renderFavoritesUI();
  if(currentModalProductId === id) updateModalFavButton(id);
};
function renderFavoritesUI(){
  const list = document.getElementById('favoritesList');
  if(!isUserLoggedIn()){
    list.innerHTML = '<div class="label" style="font-weight:400;letter-spacing:0;text-transform:none;color:var(--muted);padding:8px 0;">Đăng nhập để xem danh sách yêu thích của bạn.</div>';
    return;
  }
  const favs = getFavorites();
  const favProducts = products.filter(p=>favs.includes(p.id));
  if(favProducts.length === 0){
    list.innerHTML = '<div class="label" style="font-weight:400;letter-spacing:0;text-transform:none;color:var(--muted);padding:8px 0;">Chưa có sản phẩm yêu thích nào. Nhấn biểu tượng ♥ trên sản phẩm để lưu lại.</div>';
    return;
  }
  list.innerHTML = favProducts.map(p=>`
    <div class="playlist-row" style="cursor:pointer;" onclick="openProductDetail('${p.id}')">
      ${p.image ? `<img class="playlist-row-cover" src="${p.image}" alt="" loading="lazy">` : `<div class="playlist-row-cover"></div>`}
      <div class="playlist-row-info">
        <div class="playlist-row-title">${escapeHtml(p.title)}</div>
        <div class="playlist-row-artist">${escapeHtml(getCollectionName(p.collectionId)||'Chưa phân loại')}</div>
      </div>
      <div style="display:flex;gap:6px;flex:0 0 auto;">
        <button class="mini-btn" onclick="event.stopPropagation(); toggleFavorite('${p.id}')">Bỏ thích</button>
      </div>
    </div>
  `).join('');
}

// ---------------- PRODUCTS ----------------
let products = [];
let collections = [];
let activeCollectionFilter = null; // null = tất cả, ngược lại là id bộ sưu tập
let searchQuery = '';
let editingId = null;
let pendingImageData = null; // link ảnh hiện tại (dùng để hiển thị / giữ nguyên nếu không đổi ảnh)
let pendingImageBlob = null; // file ảnh MỚI được chọn, chờ upload lên Cloudinary khi bấm Lưu
let currentSort = 'newest';
let favOnlyFilter = false;
let bulkMode = false;
let selectedIds = new Set();
let productsLoaded = false;
const PAGE_SIZE = 24;
let visibleCount = PAGE_SIZE;

function getCollectionName(id){
  if(!id) return '';
  const c = collections.find(x=>x.id===id);
  return c ? c.name : '';
}
function collectionCount(id){
  if(!id) return products.filter(p=>!p.collectionId).length;
  return products.filter(p=>p.collectionId===id).length;
}

// Kiểm tra 1 sản phẩm có đang trong "cửa sổ hiển thị" theo lịch ẩn/hiện hay không.
// visibleFrom / visibleUntil lưu dạng chuỗi 'YYYY-MM-DD'. Nếu để trống thì không giới hạn phía đó.
function isProductVisibleNow(p){
  const now = Date.now();
  if(p.visibleFrom){
    const fromTs = new Date(p.visibleFrom + 'T00:00:00').getTime();
    if(!isNaN(fromTs) && now < fromTs) return false;
  }
  if(p.visibleUntil){
    const untilTs = new Date(p.visibleUntil + 'T23:59:59').getTime();
    if(!isNaN(untilTs) && now > untilTs) return false;
  }
  return true;
}
function isProductNew(p){
  if(!p.createdAt) return false;
  const hours = (Date.now() - p.createdAt) / (1000*60*60);
  return hours <= 48;
}

function renderSkeletons(){
  const grid = document.getElementById('productGrid');
  let html = '';
  for(let i=0;i<6;i++){
    html += `
    <div class="skeleton-parcel">
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton-line w60"></div>
        <div class="skeleton-line w90"></div>
        <div class="skeleton-line w40"></div>
      </div>
    </div>`;
  }
  grid.innerHTML = html;
}

async function renderProducts(forceFresh){
  if(!productsLoaded){
    renderSkeletons();
  }
  products = await loadProducts(forceFresh);
  productsLoaded = true;
  visibleCount = PAGE_SIZE;
  applyFiltersAndRender();
  renderFavoritesUI();
  renderDashboard();
}

function sortProducts(list){
  const sorted = [...list];
  switch(currentSort){
    case 'oldest':
      sorted.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
      break;
    case 'name-asc':
      sorted.sort((a,b)=>(a.title||'').localeCompare(b.title||'', 'vi'));
      break;
    case 'name-desc':
      sorted.sort((a,b)=>(b.title||'').localeCompare(a.title||'', 'vi'));
      break;
    case 'popular':
      sorted.sort((a,b)=>(b.views||0)-(a.views||0));
      break;
    case 'newest':
    default:
      sorted.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      break;
  }
  // Sản phẩm được ghim (pinned) luôn lên đầu, giữ nguyên thứ tự sắp xếp bên trong 2 nhóm.
  sorted.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0));
  return sorted;
}

function applyFiltersAndRender(){
  const grid = document.getElementById('productGrid');
  let filtered = products;
  // Khách thường chỉ thấy sản phẩm đang trong lịch hiển thị; Admin thấy tất cả để dễ quản lý.
  if(!isAdminUnlocked()){
    filtered = filtered.filter(isProductVisibleNow);
  }
  if(activeCollectionFilter){
    filtered = filtered.filter(p=>p.collectionId === activeCollectionFilter);
  }
  if(favOnlyFilter){
    const favs = getFavorites();
    filtered = filtered.filter(p=>favs.includes(p.id));
  }
  const q = searchQuery.trim().toLowerCase();
  if(q){
    filtered = filtered.filter(p=>
      (p.title||'').toLowerCase().includes(q) ||
      (p.desc||'').toLowerCase().includes(q)
    );
  }
  filtered = sortProducts(filtered);
  document.getElementById('countLabel').textContent = filtered.length;
  if(filtered.length===0){
    let msg = 'Chưa có sản phẩm nào. Nhấn "+ Thêm sản phẩm" để bắt đầu.';
    if(favOnlyFilter) msg = 'Bạn chưa yêu thích sản phẩm nào.';
    else if(q || activeCollectionFilter) msg = 'Không tìm thấy sản phẩm phù hợp.';
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${msg}</div>`;
    document.getElementById('loadMoreWrap').style.display = 'none';
    return;
  }
  const favs = getFavorites();
  const pageItems = filtered.slice(0, visibleCount);
  grid.innerHTML = pageItems.map((p,idx)=>{
    const colName = getCollectionName(p.collectionId);
    const isHot = !!p.pinned;
    const isNew = isProductNew(p) && !isHot;
    const isFav = favs.includes(p.id);
    const isSelected = selectedIds.has(p.id);
    const isScheduledOff = isAdminUnlocked() && !isProductVisibleNow(p);
    return `
    <div class="parcel ${isHot?'has-hot':''} ${isNew?'has-new':''} ${isSelected?'selected':''}" style="animation-delay:${Math.min(idx*0.06,0.4)}s;${isScheduledOff?'opacity:.5;':''}" onclick="handleCardClick(event,'${p.id}')">
      <div class="card-select-box ${isSelected?'checked':''}" onclick="event.stopPropagation(); toggleSelectProduct('${p.id}')">${isSelected?'✓':''}</div>
      ${isHot ? `<div class="hot-badge">🔥 Hot</div>` : ''}
      ${isNew ? `<div class="new-badge">✨ Mới</div>` : ''}
      <button class="fav-btn-card ${isFav?'active':''}" onclick="event.stopPropagation(); toggleFavorite('${p.id}')" title="Yêu thích">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      </button>
      <div class="parcel-tape">${escapeHtml(colName || 'Hàng mới')}</div>
      <div class="parcel-img-wrap">
        ${p.image ? `<img class="parcel-img" src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy">` : ''}
      </div>
      <div class="parcel-body">
        <h3>${escapeHtml(p.title)}</h3>
        <div class="parcel-desc">${linkify(p.desc||'')}</div>
        ${isScheduledOff ? `<span class="schedule-badge">🕓 Ngoài lịch hiển thị</span>` : ''}
        ${p.priceVcoin>0 ? `<div class="price-badge">💰 ${p.priceVcoin} V-coin</div>` : ''}
        <button class="stamp-btn" onclick="event.stopPropagation(); claimProduct('${p.id}')">${p.priceVcoin>0 ? `Đổi ${p.priceVcoin} V-coin` : 'Nhận sản phẩm'}</button>
        <div class="card-admin-row">
          <button class="mini-btn" onclick="event.stopPropagation(); startEdit('${p.id}')">Sửa</button>
          <button class="mini-btn" onclick="event.stopPropagation(); deleteProduct('${p.id}')">Xoá</button>
          <button class="pin-btn ${isHot?'pinned':''}" onclick="event.stopPropagation(); togglePin('${p.id}')">${isHot?'★ Đã ghim':'☆ Ghim Hot'}</button>
        </div>
      </div>
    </div>
  `;
  }).join('');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  if(filtered.length > visibleCount){
    loadMoreWrap.style.display = 'block';
  } else {
    loadMoreWrap.style.display = 'none';
  }
}
document.getElementById('loadMoreBtn').addEventListener('click', ()=>{
  visibleCount += PAGE_SIZE;
  applyFiltersAndRender();
});
// Infinite scroll: khi cuộn gần cuối trang, tự động tải thêm luôn.
window.addEventListener('scroll', ()=>{
  const homeActive = document.getElementById('view-home').classList.contains('active');
  if(!homeActive) return;
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  if(loadMoreWrap.style.display === 'none') return;
  if((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 400)){
    visibleCount += PAGE_SIZE;
    applyFiltersAndRender();
  }
});
window.handleCardClick = function(e, id){
  if(bulkMode){
    toggleSelectProduct(id);
  } else {
    openProductDetail(id);
  }
};
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function linkify(text){
  const escaped = escapeHtml(text);
  const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
  return escaped.replace(urlRegex, (match)=>{
    let href = match;
    if(!/^https?:\/\//i.test(href)) href = 'https://' + href;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${match}</a>`;
  });
}
window.claimProduct = async function(id){
  if(!isUserLoggedIn()){
    showToast('Vui lòng đăng nhập để nhận sản phẩm.');
    openUserAuthModal('login');
    return;
  }
  const p = products.find(x=>x.id===id);
  if(!p || !p.link){ showToast('Sản phẩm chưa có link nhận.'); return; }

  const price = Number(p.priceVcoin) || 0;
  // Sản phẩm có gắn giá V-coin -> trừ V-coin trước khi mở link (Admin không cần trừ, xem như miễn phí).
  if(price > 0 && !isAdminUnlocked()){
    const cur = getCurrentUser();
    if((cur.vcoin||0) < price){
      showToast(`Bạn cần ${price} V-coin để nhận sản phẩm này (hiện có ${cur.vcoin||0}).`);
      return;
    }
    const ok = await askConfirm({title:'Xác nhận đổi V-coin', message:`Dùng ${price} V-coin để nhận sản phẩm "${p.title}"?`, okText:'Đổi ngay'});
    if(!ok) return;
    // Tải lại bản mới nhất từ Firestore để tránh trừ tiền dựa trên số dư cũ (ví dụ mở nhiều tab).
    const freshUser = await loadUserDoc(cur.username);
    if(!freshUser || (freshUser.vcoin||0) < price){
      showToast('Số dư V-coin không đủ hoặc có lỗi, thử lại nhé.');
      return;
    }
    freshUser.vcoin = (freshUser.vcoin||0) - price;
    const ok2 = await saveUserDoc(freshUser);
    if(!ok2) return;
    setCurrentUser({...cur, vcoin: freshUser.vcoin});
    renderVcoinUI();
  }

  window.open(p.link, '_blank');
  p.claims = (p.claims||0) + 1;
  bumpProductStat(id, 'claims');
  if(currentModalProductId === id) renderModalStats(p);
  renderDashboard();
};
let currentModalProductId = null;
function renderModalStats(p){
  const row = document.getElementById('modalStatsRow');
  row.innerHTML = `
    <span class="modal-stat">👁 ${p.views||0} lượt xem</span>
    <span class="modal-stat">📦 ${p.claims||0} lượt nhận</span>
    ${p.priceVcoin>0 ? `<span class="modal-stat">💰 ${p.priceVcoin} V-coin</span>` : ''}
  `;
  const claimBtn = document.getElementById('modalClaimBtn');
  if(claimBtn) claimBtn.textContent = p.priceVcoin>0 ? `Đổi ${p.priceVcoin} V-coin` : 'Nhận sản phẩm';
}
function updateModalFavButton(id){
  const btn = document.getElementById('modalFavBtn');
  const active = isFavorite(id);
  btn.classList.toggle('active', active);
  const svg = btn.querySelector('svg');
  svg.setAttribute('fill', active ? 'currentColor' : 'none');
}
function renderRelatedProducts(p){
  const block = document.getElementById('relatedProductsBlock');
  const grid = document.getElementById('relatedProductsGrid');
  if(!p.collectionId){
    block.style.display = 'none';
    return;
  }
  const related = products.filter(x=>x.id!==p.id && x.collectionId===p.collectionId && (isAdminUnlocked() || isProductVisibleNow(x))).slice(0,8);
  if(related.length === 0){
    block.style.display = 'none';
    return;
  }
  grid.innerHTML = related.map(r=>`
    <div class="related-product-card" onclick="openProductDetail('${r.id}')">
      ${r.image ? `<img src="${r.image}" alt="${escapeHtml(r.title)}" loading="lazy">` : `<div style="width:100%;height:90px;background:#d8c19a;"></div>`}
      <div class="rp-title">${escapeHtml(r.title)}</div>
    </div>
  `).join('');
  block.style.display = 'block';
}
window.openProductDetail = function(id){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  currentModalProductId = id;
  document.getElementById('modalImg').src = p.image || '';
  document.getElementById('modalImg').alt = p.title || '';
  document.getElementById('modalTitle').textContent = p.title || '';
  document.getElementById('modalDesc').innerHTML = linkify(p.desc || '');
  const tagEl = document.getElementById('modalCollectionTag');
  const colName = getCollectionName(p.collectionId);
  if(colName){
    tagEl.textContent = colName;
    tagEl.style.display = 'inline-block';
  } else {
    tagEl.style.display = 'none';
  }
  renderModalStats(p);
  updateModalFavButton(id);
  renderRelatedProducts(p);
  document.getElementById('productModalOverlay').classList.add('open');
  // Tăng lượt xem (không chặn UI, âm thầm cập nhật nền)
  p.views = (p.views||0) + 1;
  bumpProductStat(id, 'views');
  renderModalStats(p);
  renderDashboard();
};
function closeProductDetail(){
  document.getElementById('productModalOverlay').classList.remove('open');
  currentModalProductId = null;
}
document.getElementById('closeProductModalBtn').addEventListener('click', closeProductDetail);
document.getElementById('modalCloseBtn2').addEventListener('click', closeProductDetail);
document.getElementById('productModalOverlay').addEventListener('click', e=>{
  if(e.target.id === 'productModalOverlay') closeProductDetail();
});
document.getElementById('modalClaimBtn').addEventListener('click', ()=>{
  if(currentModalProductId) claimProduct(currentModalProductId);
});
document.getElementById('modalFavBtn').addEventListener('click', ()=>{
  if(currentModalProductId) toggleFavorite(currentModalProductId);
});
document.getElementById('modalCopyBtn').addEventListener('click', async ()=>{
  const p = products.find(x=>x.id===currentModalProductId);
  if(!p || !p.link){ showToast('Sản phẩm chưa có link nhận.'); return; }
  try{
    await navigator.clipboard.writeText(p.link);
    showToast('Đã copy link nhận sản phẩm!');
  }catch(e){
    // Phương án dự phòng nếu Clipboard API bị chặn (VD: trang không chạy trên HTTPS)
    const ta = document.createElement('textarea');
    ta.value = p.link;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand('copy'); showToast('Đã copy link nhận sản phẩm!'); }
    catch(e2){ showToast('Không copy được, vui lòng copy thủ công.'); }
    document.body.removeChild(ta);
  }
});
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape') closeProductDetail();
});

// ---------------- TÌM KIẾM ----------------
const searchInputEl = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const searchWrapEl = document.getElementById('searchWrap');
const searchSuggestionsEl = document.getElementById('searchSuggestions');

function renderSearchSuggestions(query){
  const q = query.trim().toLowerCase();
  if(!q){ searchSuggestionsEl.classList.remove('open'); searchSuggestionsEl.innerHTML=''; return; }
  const matches = products.filter(p=>
    (p.title||'').toLowerCase().includes(q) ||
    (p.desc||'').toLowerCase().includes(q)
  ).slice(0,6);
  if(matches.length === 0){
    searchSuggestionsEl.innerHTML = `<div class="search-suggestion-empty">Không tìm thấy sản phẩm nào khớp với &ldquo;${escapeHtml(query.trim())}&rdquo;</div>`;
    searchSuggestionsEl.classList.add('open');
    return;
  }
  searchSuggestionsEl.innerHTML = matches.map(p=>{
    const colName = getCollectionName(p.collectionId);
    return `
    <div class="search-suggestion-item" onclick="selectSearchSuggestion('${p.id}')">
      <div class="search-suggestion-thumb">${p.image ? `<img src="${p.image}" alt="" loading="lazy">` : ''}</div>
      <div class="search-suggestion-info">
        <div class="search-suggestion-title">${escapeHtml(p.title)}</div>
        ${colName ? `<div class="search-suggestion-tag">${escapeHtml(colName)}</div>` : ''}
      </div>
      <span class="search-suggestion-arrow">→</span>
    </div>`;
  }).join('');
  searchSuggestionsEl.classList.add('open');
}
window.selectSearchSuggestion = function(id){
  searchSuggestionsEl.classList.remove('open');
  searchInputEl.blur();
  openProductDetail(id);
};

searchInputEl.addEventListener('input', e=>{
  searchQuery = e.target.value;
  visibleCount = PAGE_SIZE;
  applyFiltersAndRender();
  renderSearchSuggestions(searchQuery);
  searchClearBtn.style.display = searchQuery ? 'flex' : 'none';
});
searchInputEl.addEventListener('focus', ()=>{
  searchWrapEl.classList.add('focused');
  if(searchQuery.trim()) renderSearchSuggestions(searchQuery);
});
searchInputEl.addEventListener('keydown', e=>{
  if(e.key === 'Escape'){
    searchInputEl.blur();
    searchSuggestionsEl.classList.remove('open');
  }
  if(e.key === 'Enter'){
    const first = searchSuggestionsEl.querySelector('.search-suggestion-item');
    if(first) first.click();
  }
});
searchClearBtn.addEventListener('click', ()=>{
  searchQuery = '';
  searchInputEl.value = '';
  searchInputEl.focus();
  visibleCount = PAGE_SIZE;
  applyFiltersAndRender();
  searchSuggestionsEl.classList.remove('open');
  searchClearBtn.style.display = 'none';
});
document.addEventListener('click', e=>{
  if(!searchWrapEl.contains(e.target)){
    searchSuggestionsEl.classList.remove('open');
    searchWrapEl.classList.remove('focused');
  }
});
document.addEventListener('keydown', e=>{
  const tag = document.activeElement.tagName;
  if(e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT'){
    e.preventDefault();
    searchInputEl.focus();
  }
  // Phím tắt Space để phát/tạm dừng nhạc — chỉ khi không đang gõ vào ô nhập liệu nào
  // và không có modal xác nhận / auth nào đang mở (để không phá thao tác gõ Space bình thường).
  if(e.key === ' ' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT'){
    const confirmOpen = document.getElementById('confirmOverlay').classList.contains('open');
    const authOpen = document.getElementById('userAuthOverlay').style.display === 'flex';
    if(!confirmOpen && !authOpen && playlist.length > 0){
      e.preventDefault();
      userHasInteracted = true;
      togglePlayPause();
    }
  }
});

// ---------------- SẮP XẾP & LỌC YÊU THÍCH ----------------
document.getElementById('sortSelect').addEventListener('change', e=>{
  currentSort = e.target.value;
  visibleCount = PAGE_SIZE;
  applyFiltersAndRender();
});
document.getElementById('favFilterBtn').addEventListener('click', ()=>{
  if(!isUserLoggedIn()){
    showToast('Vui lòng đăng nhập để xem yêu thích.');
    openUserAuthModal('login');
    return;
  }
  favOnlyFilter = !favOnlyFilter;
  document.getElementById('favFilterBtn').classList.toggle('active', favOnlyFilter);
  visibleCount = PAGE_SIZE;
  applyFiltersAndRender();
});

// ---------------- BỘ SƯU TẬP: chip lọc trên trang chủ ----------------
function renderCollectionChipsUI(){
  const box = document.getElementById('collectionChips');
  let html = `<button class="chip ${activeCollectionFilter===null?'active':''}" onclick="setCollectionFilter(null)">Tất cả <span class="chip-count">${products.length}</span></button>`;
  collections.forEach(c=>{
    const cnt = collectionCount(c.id);
    html += `<button class="chip ${activeCollectionFilter===c.id?'active':''}" onclick="setCollectionFilter('${c.id}')">
      ${escapeHtml(c.name)} <span class="chip-count">${cnt}</span>
      <span class="chip-remove admin-only" onclick="event.stopPropagation(); deleteCollection('${c.id}')" title="Xoá bộ sưu tập">✕</span>
    </button>`;
  });
  html += `<button class="chip chip-add admin-only" onclick="promptNewCollection()">+ Bộ sưu tập</button>`;
  box.innerHTML = html;
}
window.setCollectionFilter = function(id){
  activeCollectionFilter = id;
  visibleCount = PAGE_SIZE;
  renderCollectionChipsUI();
  applyFiltersAndRender();
};
window.deleteCollection = async function(id){
  if(!checkAdmin()) return;
  const ok = await askConfirm({title:'Xoá bộ sưu tập', message:'Xoá bộ sưu tập này? Các sản phẩm trong đó sẽ chuyển về "Chưa phân loại".', okText:'Xoá', danger:true});
  if(!ok) return;
  await removeCollectionDoc(id);
  const affected = products.filter(p=>p.collectionId===id);
  for(const p of affected){
    p.collectionId = '';
    await saveProductDoc(p);
  }
  if(activeCollectionFilter === id) activeCollectionFilter = null;
  collections = await loadCollections();
  renderCollectionChipsUI();
  applyFiltersAndRender();
  showToast('Đã xoá bộ sưu tập.');
};
window.promptNewCollection = async function(){
  if(!checkAdmin()) return;
  const name = await askPrompt({title:'Bộ sưu tập mới', message:'Tên bộ sưu tập mới (VD: Mobile, Áo quần, Tài khoản...)', placeholder:'Nhập tên bộ sưu tập...', okText:'Tạo'});
  if(!name) return;
  const trimmed = name.trim();
  const exists = collections.find(c=>c.name.toLowerCase()===trimmed.toLowerCase());
  if(exists){ showToast('Bộ sưu tập này đã tồn tại.'); return; }
  const newCol = {id:'c'+Date.now(), name:trimmed, createdAt:Date.now()};
  const ok = await saveCollectionDoc(newCol);
  if(ok){
    collections = await loadCollections();
    renderCollectionChipsUI();
    showToast('Đã tạo bộ sưu tập mới!');
  }
};

// ---------------- BỘ SƯU TẬP: chọn/tạo trong form sản phẩm ----------------
function populateCollectionSelect(selectedId){
  const sel = document.getElementById('pCollection');
  let html = `<option value="">Chưa phân loại</option>`;
  collections.forEach(c=>{
    html += `<option value="${c.id}" ${selectedId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`;
  });
  html += `<option value="__new__">+ Tạo bộ sưu tập mới...</option>`;
  sel.innerHTML = html;
  document.getElementById('pNewCollectionName').style.display = 'none';
  document.getElementById('pNewCollectionName').value = '';
}
document.getElementById('pCollection').addEventListener('change', e=>{
  document.getElementById('pNewCollectionName').style.display = e.target.value === '__new__' ? 'block' : 'none';
});

window.togglePin = async function(id){
  if(!canUploadFiles()) return;
  const p = products.find(x=>x.id===id);
  if(!p) return;
  p.pinned = !p.pinned;
  const ok = await saveProductDoc(p);
  if(ok){
    applyFiltersAndRender();
    showToast(p.pinned ? 'Đã ghim làm sản phẩm nổi bật 🔥' : 'Đã bỏ ghim.');
  }
};

window.startEdit = async function(id){
  if(!canUploadFiles()) return;
  const p = products.find(x=>x.id===id);
  if(!p) return;
  editingId = id;
  pendingImageData = p.image || null;
  pendingImageBlob = null;
  document.getElementById('formTitle').textContent = 'Sửa sản phẩm';
  document.getElementById('pTitle').value = p.title;
  document.getElementById('pDesc').value = p.desc||'';
  document.getElementById('pLink').value = p.link||'';
  document.getElementById('pPriceVcoin').value = p.priceVcoin ? String(p.priceVcoin) : '';
  document.getElementById('pPinned').checked = !!p.pinned;
  document.getElementById('pVisibleFrom').value = p.visibleFrom || '';
  document.getElementById('pVisibleUntil').value = p.visibleUntil || '';
  document.getElementById('fileDrop').innerHTML = p.image ? `<img src="${p.image}">` : 'Nhấn để chọn ảnh (sẽ tự nén cho nhẹ)';
  populateCollectionSelect(p.collectionId||'');
  // Chỉ hiện nút Hoàn tác nếu có bản lưu lịch sử trước đó cho sản phẩm này.
  const historySnap = await loadProductHistorySnapshot(id);
  document.getElementById('undoEditBtn').style.display = historySnap ? 'inline-block' : 'none';
  switchView('form');
};
document.getElementById('undoEditBtn').addEventListener('click', async ()=>{
  if(!canUploadFiles() || !editingId) return;
  const snap = await loadProductHistorySnapshot(editingId);
  if(!snap){ showToast('Không có bản lưu trước đó để hoàn tác.'); return; }
  const ok = await askConfirm({title:'Hoàn tác chỉnh sửa', message:'Khôi phục sản phẩm về phiên bản trước lần sửa gần nhất?', okText:'Hoàn tác'});
  if(!ok) return;
  delete snap.savedAt;
  const saved = await saveProductDoc(snap);
  if(saved){
    await removeProductHistorySnapshot(editingId);
    products = products.map(x=>x.id===editingId?snap:x);
    applyFiltersAndRender();
    renderCollectionChipsUI();
    switchView('home');
    showToast('Đã hoàn tác về phiên bản trước.');
  }
});
window.deleteProduct = async function(id){
  if(!canUploadFiles()) return;
  const ok = await askConfirm({title:'Xoá sản phẩm', message:'Xoá sản phẩm này? Hành động này không thể hoàn tác.', okText:'Xoá', danger:true});
  if(!ok) return;
  await removeProductDoc(id);
  await removeProductHistorySnapshot(id);
  products = products.filter(x=>x.id!==id);
  selectedIds.delete(id);
  applyFiltersAndRender();
  renderCollectionChipsUI();
  renderDashboard();
  showToast('Đã xoá sản phẩm.');
};
function isAdminUnlocked(){
  return adminUnlocked;
}
// Nút "loginBtn" duy nhất trên nav giờ dùng chung cho cả Admin lẫn khách hàng:
// - Chưa đăng nhập gì cả -> mở modal đăng nhập/đăng ký chung.
// - Đã đăng nhập (Admin hoặc khách hàng) -> bấm để đăng xuất khỏi vai trò hiện tại.
document.getElementById('loginBtn').addEventListener('click', async ()=>{
  if(isAdminUnlocked()){
    try{ await signOut(auth); }catch(e){}
    adminUnlocked = false;
    clearCurrentUser();
    renderAuthUI();
    exitBulkMode();
    showToast('Đã thoát quyền quản trị.');
    applyFiltersAndRender();
  } else if(isUserLoggedIn()){
    clearCurrentUser();
    renderAuthUI();
    favOnlyFilter = false;
    document.getElementById('favFilterBtn').classList.remove('active');
    applyFiltersAndRender();
    renderFavoritesUI();
    showToast('Đã đăng xuất tài khoản.');
  } else {
    openUserAuthModal('login');
  }
});
function checkAdmin(){
  return isAdminUnlocked();
}
// canUploadFiles(): quyền quản lý sản phẩm (thêm/sửa/xoá/ghim) được mở rộng cho
// cả Admin thật (Firebase Auth) LẪN người dùng thường được Admin cấp riêng quyền
// này (field canManageFiles = true trong doc Firestore "users/{username}").
function canUploadFiles(){
  if(isAdminUnlocked()) return true;
  const cur = getCurrentUser();
  return !!(cur && cur.canManageFiles);
}

// ---------------- ADMIN: CẤP QUYỀN QUẢN LÝ FILE CHO NGƯỜI DÙNG ----------------
// Cho phép Admin tra cứu 1 tài khoản người dùng thường theo username, rồi
// cấp/thu hồi field "canManageFiles" trên doc Firestore "users/{username}".
// LƯU Ý BẢO MẬT QUAN TRỌNG: checkAdmin() ở đây chỉ ẩn/hiện giao diện và chặn
// ở phía client — đây KHÔNG phải là bảo mật thật sự. Ai đó rành kỹ thuật vẫn
// có thể gọi thẳng updateDoc() từ Console (F12) để tự cấp quyền cho mình nếu
// Firestore Rules không chặn ghi field này. Bạn BẮT BUỘC phải cập nhật
// Firestore Security Rules — xem đoạn rule mẫu ở cuối file app.js (phần
// "GHI CHÚ BẢO MẬT - FIRESTORE RULES CHO users/{username}").
let filemgrLookupResultUser = null; // doc user đang hiển thị kết quả tra cứu, null nếu chưa tra cứu / không tìm thấy

async function lookupFilemgrUser(){
  const resultBox = document.getElementById('filemgrPermResult');
  if(!checkAdmin()){
    showToast('Chỉ Admin mới có quyền tra cứu.');
    return;
  }
  const rawUsername = document.getElementById('filemgrLookupInput').value.trim();
  const username = normalizeUsername(rawUsername);
  if(!username){
    filemgrLookupResultUser = null;
    resultBox.style.display = 'block';
    resultBox.innerHTML = `<div class="filemgr-perm-error">Vui lòng nhập tên đăng nhập.</div>`;
    return;
  }
  const lookupBtn = document.getElementById('filemgrLookupBtn');
  lookupBtn.disabled = true;
  resultBox.style.display = 'block';
  resultBox.innerHTML = `<div class="filemgr-perm-error" style="color:var(--muted);">Đang tra cứu...</div>`;
  try{
    const userDoc = await loadUserDoc(username);
    lookupBtn.disabled = false;
    if(!userDoc){
      filemgrLookupResultUser = null;
      resultBox.innerHTML = `<div class="filemgr-perm-error">Không tìm thấy tài khoản "${escapeHtml(username)}".</div>`;
      return;
    }
    filemgrLookupResultUser = userDoc;
    renderFilemgrLookupResult();
  }catch(e){
    console.error(e);
    lookupBtn.disabled = false;
    filemgrLookupResultUser = null;
    resultBox.innerHTML = `<div class="filemgr-perm-error">Lỗi tra cứu: ${escapeHtml(e && e.message ? e.message : 'không rõ nguyên nhân')}</div>`;
  }
}

function renderFilemgrLookupResult(){
  const resultBox = document.getElementById('filemgrPermResult');
  const u = filemgrLookupResultUser;
  if(!u){ resultBox.style.display = 'none'; return; }
  const granted = !!u.canManageFiles;
  resultBox.style.display = 'block';
  resultBox.innerHTML = `
    <div class="filemgr-perm-result-row">
      <div>
        <div class="filemgr-perm-result-name">${escapeHtml(u.displayName || u.username)}</div>
        <div class="filemgr-perm-result-username">@${escapeHtml(u.username)}</div>
        <span class="filemgr-perm-status ${granted ? 'granted' : 'revoked'}">${granted ? '✓ Đã cấp quyền' : '✕ Chưa có quyền'}</span>
      </div>
      <button class="ghost-btn ${granted ? 'filemgr-perm-revoke-btn' : 'filemgr-perm-grant-btn'}" id="filemgrToggleBtn">${granted ? 'Thu hồi quyền' : 'Cấp quyền'}</button>
    </div>
  `;
  document.getElementById('filemgrToggleBtn').addEventListener('click', toggleFilemgrPermission);
}

async function toggleFilemgrPermission(){
  if(!checkAdmin()){
    showToast('Chỉ Admin mới có quyền này.');
    return;
  }
  const u = filemgrLookupResultUser;
  if(!u) return;
  const granting = !u.canManageFiles;
  const ok = await askConfirm({
    title: granting ? 'Cấp quyền quản lý file?' : 'Thu hồi quyền quản lý file?',
    message: granting
      ? `Cấp quyền thêm/sửa/xoá sản phẩm & file cho tài khoản "${u.username}"?`
      : `Thu hồi quyền quản lý file của tài khoản "${u.username}"?`,
    okText: granting ? 'Cấp quyền' : 'Thu hồi',
    danger: !granting
  });
  if(!ok) return;
  const btn = document.getElementById('filemgrToggleBtn');
  if(btn) btn.disabled = true;
  try{
    await updateDoc(doc(db, 'users', u.username), {canManageFiles: granting});
    filemgrLookupResultUser.canManageFiles = granting;
    renderFilemgrLookupResult();
    showToast(granting ? `Đã cấp quyền quản lý file cho ${u.username}.` : `Đã thu hồi quyền quản lý file của ${u.username}.`);
    // Nếu vừa cấp/thu hồi quyền cho chính tài khoản đang đăng nhập trên máy này
    // (VD Admin đang test bằng cùng trình duyệt) thì cập nhật lại session hiện tại luôn.
    const cur = getCurrentUser();
    if(cur && cur.username === u.username){
      setCurrentUser({...cur, canManageFiles: granting});
      renderAuthUI();
    }
  }catch(e){
    console.error(e);
    showToast('Lỗi cập nhật quyền: ' + (e && e.message ? e.message : 'không rõ nguyên nhân'));
    if(btn) btn.disabled = false;
  }
}

document.getElementById('filemgrLookupBtn').addEventListener('click', lookupFilemgrUser);
document.getElementById('filemgrLookupInput').addEventListener('keydown', e=>{ if(e.key==='Enter') lookupFilemgrUser(); });

document.getElementById('openAddBtn').addEventListener('click', ()=>{
  if(!canUploadFiles()) return;
  editingId = null;
  pendingImageData = null;
  pendingImageBlob = null;
  document.getElementById('formTitle').textContent = 'Thêm sản phẩm mới';
  document.getElementById('pTitle').value = '';
  document.getElementById('pDesc').value = '';
  document.getElementById('pLink').value = '';
  document.getElementById('pPriceVcoin').value = '';
  document.getElementById('pPinned').checked = false;
  document.getElementById('pVisibleFrom').value = '';
  document.getElementById('pVisibleUntil').value = '';
  document.getElementById('fileDrop').innerHTML = 'Nhấn để chọn ảnh (sẽ tự nén cho nhẹ)';
  document.getElementById('undoEditBtn').style.display = 'none';
  populateCollectionSelect(activeCollectionFilter || '');
  switchView('form');
});
document.getElementById('cancelFormBtn').addEventListener('click', ()=>switchView('home'));

document.getElementById('fileDrop').addEventListener('click', ()=>document.getElementById('imgInput').click());
document.getElementById('imgInput').addEventListener('change', async e=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const {previewUrl, blob} = await compressImageToBlob(file);
    pendingImageBlob = blob;
    pendingImageData = previewUrl; // chỉ để xem trước ngay lập tức, sẽ được thay bằng link Cloudinary khi Lưu
    document.getElementById('fileDrop').innerHTML = `<img src="${previewUrl}">`;
  }catch(err){
    console.error(err);
    showToast('Không đọc được ảnh, thử ảnh khác nhé.');
  }
});

function isValidDateStr(s){
  if(!s) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s+'T00:00:00').getTime());
}

document.getElementById('saveProductBtn').addEventListener('click', async ()=>{
  if(!canUploadFiles()){ showToast('Bạn không có quyền thêm/sửa sản phẩm.'); return; }
  const title = document.getElementById('pTitle').value.trim();
  const desc = document.getElementById('pDesc').value.trim();
  const link = document.getElementById('pLink').value.trim();
  const priceVcoinRaw = document.getElementById('pPriceVcoin').value.trim();
  const priceVcoin = priceVcoinRaw ? Math.max(0, parseInt(priceVcoinRaw, 10) || 0) : 0;
  const pinned = document.getElementById('pPinned').checked;
  const visibleFrom = document.getElementById('pVisibleFrom').value.trim();
  const visibleUntil = document.getElementById('pVisibleUntil').value.trim();
  if(!title){ showToast('Vui lòng nhập tên sản phẩm.'); return; }
  if(!link){ showToast('Vui lòng nhập link nhận hàng.'); return; }
  if(!isValidDateStr(visibleFrom) || !isValidDateStr(visibleUntil)){
    showToast('Ngày lịch ẩn/hiện không hợp lệ, dùng định dạng YYYY-MM-DD.');
    return;
  }

  const saveBtn = document.getElementById('saveProductBtn');
  saveBtn.disabled = true;

  // Xử lý bộ sưu tập: có thể chọn sẵn, để trống, hoặc tạo mới ngay tại đây
  let collectionId = document.getElementById('pCollection').value;
  if(collectionId === '__new__'){
    const newName = document.getElementById('pNewCollectionName').value.trim();
    if(!newName){
      showToast('Vui lòng nhập tên bộ sưu tập mới.');
      saveBtn.disabled = false;
      return;
    }
    const existing = collections.find(c=>c.name.toLowerCase()===newName.toLowerCase());
    if(existing){
      collectionId = existing.id;
    } else {
      const newCol = {id:'c'+Date.now(), name:newName, createdAt:Date.now()};
      const okCol = await saveCollectionDoc(newCol);
      if(!okCol){ saveBtn.disabled = false; return; }
      collections.push(newCol);
      collectionId = newCol.id;
    }
  }

  let imageUrl = pendingImageData;
  if(pendingImageBlob){
    showToast('Đang tải ảnh lên...');
    try{
      imageUrl = await uploadToCloudinary(pendingImageBlob);
    }catch(err){
      console.error(err);
      showToast('Lỗi tải ảnh lên: ' + (err && err.message ? err.message : 'kiểm tra Cloudinary'));
      saveBtn.disabled = false;
      return; // dừng lại, KHÔNG lưu sản phẩm nếu ảnh tải lỗi
    }
  }

  let productToSave;
  if(editingId){
    const p = products.find(x=>x.id===editingId);
    // Lưu snapshot của bản TRƯỚC khi ghi đè, để admin có thể "hoàn tác" nếu lỡ tay.
    await saveProductHistorySnapshot(p);
    p.title = title; p.desc = desc; p.link = link; p.image = imageUrl; p.collectionId = collectionId; p.pinned = pinned;
    p.visibleFrom = visibleFrom; p.visibleUntil = visibleUntil; p.priceVcoin = priceVcoin;
    productToSave = p;
  } else {
    productToSave = {id: 'p'+Date.now(), title, desc, link, image: imageUrl, collectionId, pinned, visibleFrom, visibleUntil, priceVcoin, views:0, claims:0, createdAt: Date.now()};
    products.push(productToSave);
  }

  const ok = await saveProductDoc(productToSave);
  saveBtn.disabled = false;
  if(!ok) return; // lỗi đã hiện toast bên trong saveProductDoc

  applyFiltersAndRender();
  renderCollectionChipsUI();
  renderDashboard();
  switchView('home');
  showToast('Đã lưu sản phẩm!');
});

// ---------------- BULK ACTIONS (thao tác hàng loạt cho Admin) ----------------
function enterBulkMode(){
  bulkMode = true;
  selectedIds.clear();
  document.body.classList.add('bulk-mode');
  document.getElementById('bulkToggleBtn').classList.add('active');
  document.getElementById('bulkToggleBtn').textContent = '✕ Thoát chọn';
  updateBulkBar();
  applyFiltersAndRender();
}
function exitBulkMode(){
  bulkMode = false;
  selectedIds.clear();
  document.body.classList.remove('bulk-mode');
  document.getElementById('bulkToggleBtn').classList.remove('active');
  document.getElementById('bulkToggleBtn').textContent = '☑ Chọn nhiều';
  updateBulkBar();
  applyFiltersAndRender();
}
document.getElementById('bulkToggleBtn').addEventListener('click', ()=>{
  if(!checkAdmin()) return;
  if(bulkMode) exitBulkMode(); else enterBulkMode();
});
window.toggleSelectProduct = function(id){
  if(selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  updateBulkBar();
  applyFiltersAndRender();
};
function updateBulkBar(){
  const bar = document.getElementById('bulkBar');
  bar.classList.toggle('show', bulkMode && selectedIds.size > 0);
  document.getElementById('bulkCount').textContent = selectedIds.size;
  const sel = document.getElementById('bulkCollectionSelect');
  let html = `<option value="">Chưa phân loại</option>`;
  collections.forEach(c=>{ html += `<option value="${c.id}">${escapeHtml(c.name)}</option>`; });
  sel.innerHTML = html;
}
document.getElementById('bulkCancelBtn').addEventListener('click', exitBulkMode);
document.getElementById('bulkApplyBtn').addEventListener('click', async ()=>{
  if(!checkAdmin() || selectedIds.size === 0) return;
  const collectionId = document.getElementById('bulkCollectionSelect').value;
  const btn = document.getElementById('bulkApplyBtn');
  btn.disabled = true;
  const ids = Array.from(selectedIds);
  for(const id of ids){
    const p = products.find(x=>x.id===id);
    if(p){
      p.collectionId = collectionId;
      await saveProductDoc(p);
    }
  }
  btn.disabled = false;
  showToast(`Đã gán bộ sưu tập cho ${ids.length} sản phẩm.`);
  renderCollectionChipsUI();
  exitBulkMode();
});
document.getElementById('bulkDeleteBtn').addEventListener('click', async ()=>{
  if(!checkAdmin() || selectedIds.size === 0) return;
  const ok = await askConfirm({title:'Xoá nhiều sản phẩm', message:`Xoá ${selectedIds.size} sản phẩm đã chọn? Hành động này không thể hoàn tác.`, okText:'Xoá tất cả', danger:true});
  if(!ok) return;
  const ids = Array.from(selectedIds);
  for(const id of ids){
    await removeProductDoc(id);
  }
  products = products.filter(p=>!selectedIds.has(p.id));
  showToast(`Đã xoá ${ids.length} sản phẩm.`);
  renderCollectionChipsUI();
  renderDashboard();
  exitBulkMode();
});

// ---------------- DASHBOARD (Admin: thống kê + Export/Import) ----------------
function renderDashboard(){
  if(!isAdminUnlocked()) return;
  const totalProducts = products.length;
  const totalViews = products.reduce((sum,p)=>sum+(p.views||0),0);
  const totalClaims = products.reduce((sum,p)=>sum+(p.claims||0),0);
  document.getElementById('dashTotalProducts').textContent = totalProducts;
  document.getElementById('dashTotalViews').textContent = totalViews;
  document.getElementById('dashTotalClaims').textContent = totalClaims;

  const top5 = [...products].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,5);
  const listEl = document.getElementById('dashboardTopList');
  if(top5.length === 0){
    listEl.innerHTML = '<div class="label" style="font-weight:400;letter-spacing:0;text-transform:none;color:var(--muted);padding:6px 0;">Chưa có dữ liệu.</div>';
    return;
  }
  listEl.innerHTML = top5.map((p,idx)=>`
    <div class="dashboard-top-row">
      <span class="dashboard-top-rank">#${idx+1}</span>
      ${p.image ? `<img class="dashboard-top-cover" src="${p.image}" alt="" loading="lazy">` : `<div class="dashboard-top-cover"></div>`}
      <span class="dashboard-top-name">${escapeHtml(p.title)}</span>
      <span class="dashboard-top-views">👁 ${p.views||0}</span>
    </div>
  `).join('');
}

document.getElementById('exportJsonBtn').addEventListener('click', ()=>{
  if(!checkAdmin()) return;
  const exportData = {
    exportedAt: new Date().toISOString(),
    products, collections,
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kho-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã tải file backup JSON.');
});
document.getElementById('importJsonBtn').addEventListener('click', ()=>{
  if(!checkAdmin()) return;
  document.getElementById('importJsonInput').click();
});
document.getElementById('importJsonInput').addEventListener('change', async e=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    const importedProducts = Array.isArray(data.products) ? data.products : [];
    const importedCollections = Array.isArray(data.collections) ? data.collections : [];
    if(importedProducts.length === 0 && importedCollections.length === 0){
      showToast('File JSON không có dữ liệu hợp lệ để nhập.');
      return;
    }
    const ok = await askConfirm({
      title:'Nhập dữ liệu từ JSON',
      message:`Sẽ nhập ${importedProducts.length} sản phẩm và ${importedCollections.length} bộ sưu tập. Các sản phẩm/bộ sưu tập trùng ID sẽ bị ghi đè. Tiếp tục?`,
      okText:'Nhập dữ liệu'
    });
    if(!ok) return;
    for(const c of importedCollections){
      await saveCollectionDoc(c);
    }
    for(const p of importedProducts){
      await saveProductDoc(p);
    }
    collections = await loadCollections();
    await renderProducts(true);
    renderCollectionChipsUI();
    showToast('Đã nhập dữ liệu thành công!');
  }catch(err){
    console.error(err);
    showToast('File JSON không hợp lệ, kiểm tra lại nhé.');
  } finally {
    e.target.value = '';
  }
});

// ---------------- PROFILE ----------------
let profileData = {siteName:'Kho Của Bạn', name:'', bio:'', avatar:'', socials:[], welcomeTitle:'Xin chào! 👋', welcomeBody:'Chào mừng bạn đến với gian hàng. Chọn sản phẩm bạn thích và nhấn "Nhận sản phẩm" để lấy về nhé.'};

async function renderProfile(){
  const p = await loadProfile();
  if(p) profileData = p;
  document.getElementById('siteTitle').innerHTML = renderSiteTitle(profileData.siteName);
  document.getElementById('pfName').textContent = profileData.name || 'Chưa đặt tên';
  document.getElementById('pfBio').textContent = profileData.bio || 'Chưa có giới thiệu.';
  document.getElementById('pfAvatar').src = profileData.avatar || defaultAvatar();
  document.getElementById('pfSiteNameLabel').textContent = (profileData.siteName||'KHO CỦA BẠN').toUpperCase();
  document.getElementById('welcomeTitle').textContent = profileData.welcomeTitle || 'Xin chào! 👋';
  document.getElementById('welcomeBody').textContent = profileData.welcomeBody || 'Chào mừng bạn đến với gian hàng. Chọn sản phẩm bạn thích và nhấn "Nhận sản phẩm" để lấy về nhé.';
  const socials = document.getElementById('pfSocials');
  socials.innerHTML = (profileData.socials||[]).map(s=>`<a href="${s.url}" target="_blank">${escapeHtml(s.label)} <span>↗</span></a>`).join('');
}
function renderSiteTitle(name){
  name = name || 'Kho Của Bạn';
  const parts = name.split(' ');
  const last = parts.pop();
  return parts.join(' ') + ' <span>' + last + '</span>';
}
function defaultAvatar(){
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><rect width="88" height="88" fill="%23DCC6A0"/></svg>`).replace(/%23/g,'#');
}

document.getElementById('editProfileBtn').addEventListener('click', ()=>{
  if(!checkAdmin()) return;
  document.getElementById('fSiteName').value = profileData.siteName||'';
  document.getElementById('fName').value = profileData.name||'';
  document.getElementById('fBio').value = profileData.bio||'';
  document.getElementById('fSocials').value = (profileData.socials||[]).map(s=>`${s.label} | ${s.url}`).join('\n');
  document.getElementById('fWelcomeTitle').value = profileData.welcomeTitle || 'Xin chào! 👋';
  document.getElementById('fWelcomeBody').value = profileData.welcomeBody || 'Chào mừng bạn đến với gian hàng. Chọn sản phẩm bạn thích và nhấn "Nhận sản phẩm" để lấy về nhé.';
  document.getElementById('avatarDrop').innerHTML = profileData.avatar ? `<img src="${profileData.avatar}" class="avatar">` : 'Nhấn để chọn ảnh đại diện';
  pendingAvatarBlob = null;
  document.getElementById('profileEditForm').style.display = 'block';
  document.getElementById('profileEditForm').scrollIntoView({behavior:'smooth'});
});
document.getElementById('cancelProfileBtn').addEventListener('click', ()=>{
  document.getElementById('profileEditForm').style.display='none';
});

let pendingAvatarBlob = null; // file ảnh đại diện MỚI, chờ upload lên Cloudinary khi bấm Lưu
document.getElementById('avatarDrop').addEventListener('click', ()=>document.getElementById('avatarInput').click());
document.getElementById('avatarInput').addEventListener('change', async e=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const {previewUrl, blob} = await compressImageToBlob(file, 300, 0.85);
    pendingAvatarBlob = blob;
    document.getElementById('avatarDrop').innerHTML = `<img src="${previewUrl}" class="avatar">`;
  }catch(err){
    console.error(err);
    showToast('Không đọc được ảnh đại diện, thử ảnh khác nhé.');
  }
});

document.getElementById('saveProfileBtn').addEventListener('click', async ()=>{
  const saveBtn = document.getElementById('saveProfileBtn');
  saveBtn.disabled = true;

  profileData.siteName = document.getElementById('fSiteName').value.trim() || 'Kho Của Bạn';
  profileData.name = document.getElementById('fName').value.trim();
  profileData.bio = document.getElementById('fBio').value.trim();
  profileData.socials = document.getElementById('fSocials').value.split('\n')
    .map(l=>l.split('|').map(s=>s.trim()))
    .filter(pair=>pair.length===2 && pair[0] && pair[1])
    .map(([label,url])=>({label,url}));
  profileData.welcomeTitle = document.getElementById('fWelcomeTitle').value.trim() || 'Xin chào! 👋';
  profileData.welcomeBody = document.getElementById('fWelcomeBody').value.trim() || 'Chào mừng bạn đến với gian hàng. Chọn sản phẩm bạn thích và nhấn "Nhận sản phẩm" để lấy về nhé.';

  if(pendingAvatarBlob){
    showToast('Đang tải ảnh đại diện lên...');
    try{
      profileData.avatar = await uploadToCloudinary(pendingAvatarBlob);
    }catch(err){
      console.error(err);
      showToast('Lỗi tải ảnh đại diện: ' + (err && err.message ? err.message : 'kiểm tra Cloudinary'));
      saveBtn.disabled = false;
      return; // dừng lại, không lưu hồ sơ nếu ảnh lỗi
    }
  }

  const ok = await saveProfile(profileData);
  saveBtn.disabled = false;
  if(!ok) return; // lỗi đã hiện toast bên trong saveProfile

  document.getElementById('profileEditForm').style.display='none';
  renderProfile();
  showToast('Đã lưu hồ sơ!');
});

// ---------------- PLAYLIST NHẠC ----------------
let playlist = [];
let editingSongId = null;
let pendingCoverData = null; // link ảnh bìa hiện tại
let pendingCoverBlob = null; // ảnh bìa MỚI, chờ upload khi Lưu
let pendingAudioFile = null; // file nhạc MỚI, chờ upload khi Lưu
let pendingAudioUrl = null; // link nhạc hiện tại (khi sửa mà không đổi file)

async function renderPlaylistAdmin(){
  playlist = await loadPlaylist();
  const list = document.getElementById('playlistList');
  if(playlist.length === 0){
    list.innerHTML = '<div class="label" style="font-weight:400;letter-spacing:0;text-transform:none;color:var(--muted);padding:8px 0;">Chưa có bài hát nào.</div>';
  } else {
    list.innerHTML = playlist.map((s,idx)=>`
      <div class="playlist-row">
        ${s.cover ? `<img class="playlist-row-cover" src="${s.cover}" alt="" loading="lazy">` : `<div class="playlist-row-cover"></div>`}
        <div class="playlist-row-info">
          <div class="playlist-row-title">${escapeHtml(s.title)}</div>
          <div class="playlist-row-artist">${escapeHtml(s.artist||'')}</div>
        </div>
        <div class="playlist-row-actions">
          <button class="mini-btn" onclick="startEditSong('${s.id}')">Sửa</button>
          <button class="mini-btn" onclick="deleteSong('${s.id}')">Xoá</button>
        </div>
      </div>
    `).join('');
  }
  setupPlayerForPlaylist();
}

function resetSongForm(){
  editingSongId = null;
  pendingCoverData = null;
  pendingCoverBlob = null;
  pendingAudioFile = null;
  pendingAudioUrl = null;
  document.getElementById('sTitle').value = '';
  document.getElementById('sArtist').value = '';
  document.getElementById('coverDrop').innerHTML = 'Nhấn để chọn ảnh bìa (hình vuông đẹp nhất)';
  document.getElementById('audioDrop').innerHTML = 'Nhấn để chọn file nhạc';
  document.getElementById('audioStatus').textContent = '';
}

document.getElementById('openAddSongBtn').addEventListener('click', ()=>{
  if(!checkAdmin()) return;
  resetSongForm();
  document.getElementById('songFormTitle').textContent = 'Thêm bài hát mới';
  switchView('song-form');
});
document.getElementById('cancelSongFormBtn').addEventListener('click', ()=>switchView('profile'));

window.startEditSong = function(id){
  if(!checkAdmin()) return;
  const s = playlist.find(x=>x.id===id);
  if(!s) return;
  resetSongForm();
  editingSongId = id;
  pendingCoverData = s.cover || null;
  pendingAudioUrl = s.audioUrl || null;
  document.getElementById('songFormTitle').textContent = 'Sửa bài hát';
  document.getElementById('sTitle').value = s.title || '';
  document.getElementById('sArtist').value = s.artist || '';
  document.getElementById('coverDrop').innerHTML = s.cover ? `<img src="${s.cover}">` : 'Nhấn để chọn ảnh bìa (hình vuông đẹp nhất)';
  document.getElementById('audioDrop').innerHTML = 'Nhấn để chọn file nhạc';
  document.getElementById('audioStatus').textContent = s.audioUrl ? 'Đang dùng: file nhạc đã tải lên trước đó.' : '';
  switchView('song-form');
};
window.deleteSong = async function(id){
  if(!checkAdmin()) return;
  const ok = await askConfirm({title:'Xoá bài hát', message:'Xoá bài hát này?', okText:'Xoá', danger:true});
  if(!ok) return;
  await removePlaylistDoc(id);
  playlist = playlist.filter(x=>x.id!==id);
  await renderPlaylistAdmin();
  showToast('Đã xoá bài hát.');
};

document.getElementById('coverDrop').addEventListener('click', ()=>document.getElementById('coverInput').click());
document.getElementById('coverInput').addEventListener('change', async e=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const {previewUrl, blob} = await compressImageToBlob(file, 500, 0.8);
    pendingCoverBlob = blob;
    pendingCoverData = previewUrl;
    document.getElementById('coverDrop').innerHTML = `<img src="${previewUrl}">`;
  }catch(err){
    console.error(err);
    showToast('Không đọc được ảnh bìa, thử ảnh khác nhé.');
  }
});

document.getElementById('audioDrop').addEventListener('click', ()=>document.getElementById('audioInput').click());
document.getElementById('audioInput').addEventListener('change', e=>{
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > 15*1024*1024){
    showToast('File nhạc quá lớn, chọn file dưới 15MB nhé.');
    return;
  }
  pendingAudioFile = file;
  document.getElementById('audioStatus').textContent = `Đã chọn: ${file.name} (chưa lưu — nhấn "Lưu bài hát" để áp dụng)`;
});

document.getElementById('saveSongBtn').addEventListener('click', async ()=>{
  const title = document.getElementById('sTitle').value.trim();
  const artist = document.getElementById('sArtist').value.trim();
  if(!title){ showToast('Vui lòng nhập tên bài hát.'); return; }
  if(!pendingAudioFile && !pendingAudioUrl){ showToast('Vui lòng chọn file nhạc.'); return; }

  const saveBtn = document.getElementById('saveSongBtn');
  saveBtn.disabled = true;

  let coverUrl = pendingCoverData;
  if(pendingCoverBlob){
    showToast('Đang tải ảnh bìa lên...');
    try{
      coverUrl = await uploadToCloudinary(pendingCoverBlob);
    }catch(err){
      console.error(err);
      showToast('Lỗi tải ảnh bìa: ' + (err && err.message ? err.message : 'kiểm tra Cloudinary'));
      saveBtn.disabled = false;
      return;
    }
  }

  let audioUrl = pendingAudioUrl;
  if(pendingAudioFile){
    showToast('Đang tải nhạc lên...');
    try{
      audioUrl = await uploadToCloudinary(pendingAudioFile);
    }catch(err){
      console.error(err);
      showToast('Lỗi tải nhạc lên: ' + (err && err.message ? err.message : 'kiểm tra Cloudinary'));
      saveBtn.disabled = false;
      return;
    }
  }

  let songToSave;
  if(editingSongId){
    const s = playlist.find(x=>x.id===editingSongId);
    s.title = title; s.artist = artist; s.cover = coverUrl; s.audioUrl = audioUrl;
    songToSave = s;
  } else {
    songToSave = {id:'s'+Date.now(), title, artist, cover:coverUrl, audioUrl, createdAt: Date.now()};
    playlist.push(songToSave);
  }

  const ok = await savePlaylistDoc(songToSave);
  saveBtn.disabled = false;
  if(!ok) return;

  await renderPlaylistAdmin();
  switchView('profile');
  showToast('Đã lưu bài hát!');
});

// ---------------- MUSIC PLAYER ----------------
const bgAudio = document.getElementById('bgAudio');
const playerBar = document.getElementById('playerBar');
const playerDisc = document.getElementById('playerDisc');
const playerDiscImg = document.getElementById('playerDiscImg');
const playerTitleEl = document.getElementById('playerTitle');
const playerArtistEl = document.getElementById('playerArtist');
const playerSeek = document.getElementById('playerSeek');
const playerCurrentTimeEl = document.getElementById('playerCurrentTime');
const playerDurationEl = document.getElementById('playerDuration');
const playerPlayIcon = document.getElementById('playerPlayIcon');
const playerDeleteBtn = document.getElementById('playerDeleteBtn');
const playerShuffleBtn = document.getElementById('playerShuffleBtn');
const playerRepeatBtn = document.getElementById('playerRepeatBtn');
const playerMuteBtn = document.getElementById('playerMuteBtn');
const playerVolIcon = document.getElementById('playerVolIcon');
const playerVolume = document.getElementById('playerVolume');
const playerDiscWrap = document.getElementById('playerDiscWrap');
const queueOverlay = document.getElementById('queueOverlay');
const queueList = document.getElementById('queueList');

let currentTrackIndex = 0;
let musicPlaying = false;
let userHasInteracted = false;
let seekDragging = false;
let shuffleOn = true; // mặc định phát ngẫu nhiên khi vào web
let repeatOn = false;
let lastVolume = 0.5;
let isMuted = false;
let shuffleHistory = [];
const RESUME_POS_KEY = 'musicResumePositions'; // lưu vị trí nghe dở theo từng bài hát (id -> giây)

function getResumePositions(){
  try{
    const raw = localStorage.getItem(RESUME_POS_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function saveResumePosition(trackId, seconds){
  if(!trackId) return;
  try{
    const positions = getResumePositions();
    positions[trackId] = seconds;
    localStorage.setItem(RESUME_POS_KEY, JSON.stringify(positions));
  }catch(e){ /* localStorage đầy hoặc bị chặn, bỏ qua */ }
}
function getResumePosition(trackId){
  const positions = getResumePositions();
  return positions[trackId] || 0;
}

function formatTime(sec){
  if(!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

function setupPlayerForPlaylist(){
  if(playlist.length === 0){
    playerBar.classList.add('hidden');
    return;
  }
  playerBar.classList.remove('hidden');
  playerShuffleBtn.classList.toggle('toggled', shuffleOn);
  // Vào web là phát ngẫu nhiên một bài bất kỳ trong danh sách, không theo thứ tự.
  currentTrackIndex = shuffleOn ? Math.floor(Math.random()*playlist.length) : 0;
  if(currentTrackIndex >= playlist.length) currentTrackIndex = 0;
  loadTrack(currentTrackIndex, false);
  expandPlayer();
}

function loadTrack(index, autoplay){
  if(playlist.length === 0) return;
  // Lưu lại vị trí nghe dở của bài hiện tại trước khi chuyển bài khác.
  const prevTrack = playlist[currentTrackIndex];
  if(prevTrack && bgAudio.currentTime > 0){
    saveResumePosition(prevTrack.id, bgAudio.currentTime);
  }
  currentTrackIndex = ((index % playlist.length) + playlist.length) % playlist.length;
  const track = playlist[currentTrackIndex];
  bgAudio.src = track.audioUrl;
  playerTitleEl.textContent = track.title || 'Không có tên';
  playerArtistEl.textContent = track.artist || '—';
  if(track.cover){
    playerDiscImg.src = track.cover;
    playerDiscImg.style.display = 'block';
    playerDisc.classList.add('has-art');
  } else {
    playerDiscImg.style.display = 'none';
    playerDisc.classList.remove('has-art');
  }
  playerSeek.value = 0;
  playerCurrentTimeEl.textContent = '00:00';
  playerDurationEl.textContent = '00:00';
  renderQueueList();
  // Khôi phục vị trí nghe dở lần trước (nếu có) ngay khi metadata sẵn sàng.
  const resumeAt = getResumePosition(track.id);
  if(resumeAt > 0){
    const onLoaded = ()=>{
      if(resumeAt < bgAudio.duration - 3){
        bgAudio.currentTime = resumeAt;
      }
      bgAudio.removeEventListener('loadedmetadata', onLoaded);
    };
    bgAudio.addEventListener('loadedmetadata', onLoaded);
  }
  if(autoplay){
    playTrack();
  } else {
    pauseTrack();
  }
}

async function playTrack(){
  bgAudio.volume = isMuted ? 0 : lastVolume;
  try{
    await bgAudio.play();
    musicPlaying = true;
    playerDisc.classList.remove('paused');
    playerPlayIcon.innerHTML = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';
  }catch(e){ console.error('Không phát được nhạc:', e); }
}
function pauseTrack(){
  bgAudio.pause();
  musicPlaying = false;
  playerDisc.classList.add('paused');
  playerPlayIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  const track = playlist[currentTrackIndex];
  if(track) saveResumePosition(track.id, bgAudio.currentTime);
}
function togglePlayPause(){
  userHasInteracted = true;
  if(musicPlaying) pauseTrack(); else playTrack();
}
function pickRandomIndex(){
  if(playlist.length <= 1) return currentTrackIndex;
  let next;
  do{ next = Math.floor(Math.random()*playlist.length); }
  while(next === currentTrackIndex);
  return next;
}
function nextTrack(){
  if(repeatOn){
    loadTrack(currentTrackIndex, musicPlaying || userHasInteracted);
    return;
  }
  const idx = shuffleOn ? pickRandomIndex() : currentTrackIndex+1;
  loadTrack(idx, musicPlaying || userHasInteracted);
}
function prevTrack(){
  const idx = shuffleOn ? pickRandomIndex() : currentTrackIndex-1;
  loadTrack(idx, musicPlaying || userHasInteracted);
}

document.getElementById('playerPlayBtn').addEventListener('click', togglePlayPause);
document.getElementById('playerNextBtn').addEventListener('click', ()=>{ userHasInteracted = true; nextTrack(); });
document.getElementById('playerPrevBtn').addEventListener('click', ()=>{ userHasInteracted = true; prevTrack(); });

playerShuffleBtn.addEventListener('click', ()=>{
  shuffleOn = !shuffleOn;
  playerShuffleBtn.classList.toggle('toggled', shuffleOn);
  showToast(shuffleOn ? 'Đã bật phát ngẫu nhiên' : 'Đã tắt phát ngẫu nhiên');
});
playerRepeatBtn.addEventListener('click', ()=>{
  repeatOn = !repeatOn;
  playerRepeatBtn.classList.toggle('toggled', repeatOn);
  showToast(repeatOn ? 'Đã bật lặp lại bài này' : 'Đã tắt lặp lại');
});
playerMuteBtn.addEventListener('click', ()=>{
  isMuted = !isMuted;
  bgAudio.volume = isMuted ? 0 : lastVolume;
  updateVolumeIcon();
});
function updateVolumeIcon(){
  if(isMuted || lastVolume === 0){
    playerVolIcon.innerHTML = '<path d="M16.5 12A4.5 4.5 0 0 0 14 8v2.18l2.45 2.45c.03-.2.05-.42.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>';
  } else if(lastVolume < 0.5){
    playerVolIcon.innerHTML = '<path d="M18.5 12A4.5 4.5 0 0 0 16 8v8a4.5 4.5 0 0 0 2.5-4z"/><path d="M5 9v6h4l5 5V4L9 9H5z"/>';
  } else {
    playerVolIcon.innerHTML = '<path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12z"/>';
  }
}
playerVolume.addEventListener('input', ()=>{
  lastVolume = playerVolume.value / 100;
  isMuted = lastVolume === 0;
  bgAudio.volume = lastVolume;
  updateVolumeIcon();
});
playerVolume.value = Math.round(lastVolume*100);

bgAudio.addEventListener('timeupdate', ()=>{
  if(seekDragging) return;
  if(bgAudio.duration){
    playerSeek.value = (bgAudio.currentTime / bgAudio.duration) * 1000;
    playerDurationEl.textContent = formatTime(bgAudio.duration);
  }
  playerCurrentTimeEl.textContent = formatTime(bgAudio.currentTime);
});
bgAudio.addEventListener('loadedmetadata', ()=>{
  playerDurationEl.textContent = formatTime(bgAudio.duration);
});
bgAudio.addEventListener('ended', ()=>{
  const track = playlist[currentTrackIndex];
  if(track) saveResumePosition(track.id, 0); // bài đã nghe xong, xoá vị trí dở để lần sau phát lại từ đầu
  nextTrack();
});
// Định kỳ lưu vị trí nghe dở để không mất tiến trình nếu người dùng đóng tab đột ngột.
setInterval(()=>{
  if(musicPlaying){
    const track = playlist[currentTrackIndex];
    if(track) saveResumePosition(track.id, bgAudio.currentTime);
  }
}, 5000);
window.addEventListener('beforeunload', ()=>{
  const track = playlist[currentTrackIndex];
  if(track) saveResumePosition(track.id, bgAudio.currentTime);
});
playerSeek.addEventListener('input', ()=>{ seekDragging = true; });
playerSeek.addEventListener('change', ()=>{
  if(bgAudio.duration){
    bgAudio.currentTime = (playerSeek.value/1000) * bgAudio.duration;
  }
  seekDragging = false;
});

document.getElementById('closeWelcomeBtn').addEventListener('click', ()=>{
  document.getElementById('welcomeOverlay').style.display = 'none';
  userHasInteracted = true;
  if(playlist.length > 0) playTrack();
});

// Tự thu gọn player thành đĩa nhạc sau 2s không tương tác
let collapseTimer = null;
function scheduleCollapse(){
  clearTimeout(collapseTimer);
  collapseTimer = setTimeout(()=>{
    playerBar.classList.add('collapsed');
  }, 2000);
}
function expandPlayer(){
  playerBar.classList.remove('collapsed');
  scheduleCollapse();
}
['mouseenter','click','touchstart','input'].forEach(evt=>{
  playerBar.addEventListener(evt, expandPlayer);
});

playerDeleteBtn.addEventListener('click', async (e)=>{
  e.stopPropagation();
  if(!checkAdmin()) return;
  const track = playlist[currentTrackIndex];
  if(!track) return;
  await window.deleteSong(track.id);
});

// ---------------- QUEUE (xem trước danh sách phát) ----------------
function renderQueueList(){
  if(playlist.length === 0){
    queueList.innerHTML = '<div class="label" style="font-weight:400;letter-spacing:0;text-transform:none;color:var(--muted);padding:8px 0;">Chưa có bài hát nào.</div>';
    return;
  }
  queueList.innerHTML = playlist.map((s,idx)=>`
    <div class="queue-item ${idx===currentTrackIndex?'active':''}" onclick="playFromQueue(${idx})">
      ${s.cover ? `<img class="queue-item-cover" src="${s.cover}" alt="" loading="lazy">` : `<div class="queue-item-cover"></div>`}
      <div class="queue-item-info">
        <div class="queue-item-title">${escapeHtml(s.title)}</div>
        <div class="queue-item-artist">${escapeHtml(s.artist||'')}</div>
      </div>
      ${idx===currentTrackIndex ? '<span style="font-size:12px;">▶</span>' : ''}
    </div>
  `).join('');
}
window.playFromQueue = function(idx){
  userHasInteracted = true;
  loadTrack(idx, true);
  queueOverlay.classList.remove('open');
};
playerDiscWrap.addEventListener('click', (e)=>{
  e.stopPropagation();
  renderQueueList();
  queueOverlay.classList.add('open');
});
queueOverlay.addEventListener('click', e=>{
  if(e.target.id === 'queueOverlay') queueOverlay.classList.remove('open');
});
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape') queueOverlay.classList.remove('open');
});

// ---------------- MÀN HÌNH GIỚI THIỆU: render + tương tác ----------------
let showcaseItems = [];
let showcaseIndex = 0;
let showcaseAutoTimer = null;

function stopAllShowcaseVideos(exceptIndex){
  document.querySelectorAll('.showcase-slide video').forEach(v=>{
    const idx = Number(v.dataset.idx);
    if(idx !== exceptIndex){ v.pause(); }
  });
}

function goToShowcaseSlide(idx){
  if(showcaseItems.length === 0) return;
  showcaseIndex = ((idx % showcaseItems.length) + showcaseItems.length) % showcaseItems.length;
  const track = document.getElementById('showcaseTrack');
  if(track) track.style.transform = `translateX(-${showcaseIndex * 100}%)`;
  document.querySelectorAll('.showcase-dot').forEach((d,i)=>d.classList.toggle('active', i===showcaseIndex));
  const counter = document.getElementById('showcaseCounter');
  if(counter) counter.textContent = showcaseItems.length > 1 ? `${showcaseIndex+1} / ${showcaseItems.length}` : '';
  stopAllShowcaseVideos(showcaseIndex);
  const activeVideo = document.querySelector(`.showcase-slide video[data-idx="${showcaseIndex}"]`);
  if(activeVideo){ activeVideo.currentTime = 0; activeVideo.play().catch(()=>{}); }
  resetShowcaseAutoplay();
}
function resetShowcaseAutoplay(){
  if(showcaseAutoTimer) clearInterval(showcaseAutoTimer);
  const current = showcaseItems[showcaseIndex];
  if(showcaseItems.length > 1 && (!current || current.type !== 'video')){
    showcaseAutoTimer = setInterval(()=>goToShowcaseSlide(showcaseIndex+1), 5000);
  }
}

async function removeShowcaseItem(idx){
  const ok = await askConfirm({title:'Xoá mục này?', message:'Ảnh/video này sẽ bị xoá khỏi màn hình giới thiệu.', okText:'Xoá', danger:true});
  if(!ok) return;
  showcaseItems.splice(idx,1);
  const saved = await saveShowcase(showcaseItems);
  if(saved){ showToast('Đã xoá.'); renderShowcaseUI(); }
}

function renderShowcaseUI(){
  const section = document.getElementById('showcaseSection');
  const track = document.getElementById('showcaseTrack');
  const dots = document.getElementById('showcaseDots');
  const admin = isAdminUnlocked();

  if(showcaseItems.length === 0 && !admin){
    section.classList.add('showcase-hidden');
    return;
  }
  section.classList.remove('showcase-hidden');

  if(showcaseItems.length === 0){
    track.innerHTML = `<div class="showcase-slide"><div class="showcase-slide-empty">Chưa có ảnh/video giới thiệu nào.<br>Bấm "+ Ảnh" hoặc "+ Video" bên dưới để thêm.</div></div>`;
    dots.innerHTML = '';
    document.getElementById('showcaseCounter').textContent = '';
    document.getElementById('showcasePrevBtn').style.display = 'none';
    document.getElementById('showcaseNextBtn').style.display = 'none';
    return;
  }

  document.getElementById('showcasePrevBtn').style.display = showcaseItems.length > 1 ? 'flex' : 'none';
  document.getElementById('showcaseNextBtn').style.display = showcaseItems.length > 1 ? 'flex' : 'none';

  track.innerHTML = showcaseItems.map((it,i)=>{
    const media = it.type === 'video'
      ? `<video data-idx="${i}" src="${it.url}" muted playsinline controls${showcaseItems.length===1?' loop':''}></video>`
      : `<div class="showcase-img-bg" style="background-image:url('${it.url}')"></div><img src="${it.url}" alt="" loading="lazy">`;
    const removeBtn = `<button class="showcase-slide-remove admin-only" title="Xoá" onclick="removeShowcaseItemUI(${i})">✕</button>`;
    return `<div class="showcase-slide">${media}${removeBtn}</div>`;
  }).join('');

  dots.innerHTML = showcaseItems.map((_,i)=>
    `<button class="showcase-dot${i===showcaseIndex?' active':''}" onclick="goToShowcaseSlideUI(${i})" aria-label="Đến mục ${i+1}"></button>`
  ).join('');

  track.querySelectorAll('video').forEach(v=>{
    v.addEventListener('ended', ()=>{
      if(showcaseItems.length > 1) goToShowcaseSlide(showcaseIndex+1);
    });
  });

  if(showcaseIndex >= showcaseItems.length) showcaseIndex = 0;
  goToShowcaseSlide(showcaseIndex);
}
window.goToShowcaseSlideUI = function(i){ goToShowcaseSlide(i); };
window.removeShowcaseItemUI = function(i){ removeShowcaseItem(i); };

async function renderShowcase(){
  showcaseItems = await loadShowcase();
  showcaseIndex = 0;
  renderShowcaseUI();
}

document.getElementById('showcasePrevBtn').addEventListener('click', ()=>goToShowcaseSlide(showcaseIndex-1));
document.getElementById('showcaseNextBtn').addEventListener('click', ()=>goToShowcaseSlide(showcaseIndex+1));

document.getElementById('showcaseAddImgBtn').addEventListener('click', ()=>{
  if(!checkAdmin()) return;
  document.getElementById('showcaseImgInput').click();
});
document.getElementById('showcaseAddVideoBtn').addEventListener('click', ()=>{
  if(!checkAdmin()) return;
  document.getElementById('showcaseVideoInput').click();
});

document.getElementById('showcaseImgInput').addEventListener('change', async e=>{
  const file = e.target.files[0];
  e.target.value = '';
  if(!file) return;
  showToast('Đang tải ảnh lên...');
  try{
    const {blob} = await compressImageToBlob(file, 1400, 0.82);
    const url = await uploadToCloudinary(blob);
    showcaseItems.push({type:'image', url});
    const saved = await saveShowcase(showcaseItems);
    if(saved){ showToast('Đã thêm ảnh.'); showcaseIndex = showcaseItems.length-1; renderShowcaseUI(); }
  }catch(err){
    console.error(err);
    showToast('Lỗi tải ảnh lên: ' + (err && err.message ? err.message : 'không rõ nguyên nhân'));
  }
});

document.getElementById('showcaseVideoInput').addEventListener('change', async e=>{
  const file = e.target.files[0];
  e.target.value = '';
  if(!file) return;
  if(file.size > 50*1024*1024){
    showToast('Video quá lớn (>50MB), chọn video nhẹ hơn nhé.');
    return;
  }
  showToast('Đang tải video lên, có thể mất chút thời gian...');
  try{
    const url = await uploadToCloudinary(file);
    showcaseItems.push({type:'video', url});
    const saved = await saveShowcase(showcaseItems);
    if(saved){ showToast('Đã thêm video.'); showcaseIndex = showcaseItems.length-1; renderShowcaseUI(); }
  }catch(err){
    console.error(err);
    showToast('Lỗi tải video lên: ' + (err && err.message ? err.message : 'không rõ nguyên nhân'));
  }
});

// ---------------- CHAT / FEEDBACK CÔNG KHAI ----------------
const CHAT_COLLECTION = 'feedbackChat';
let chatUnsub = null;
let chatMessagesCache = [];
let chatStickToBottom = true; // true = tự cuộn xuống cuối mỗi khi có tin mới
let chatScrollListenerAttached = false;

function formatChatTime(ts){
  if(!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});
  if(sameDay) return hm;
  return d.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'}) + ' ' + hm;
}

function canChat(){
  return isUserLoggedIn() || isAdminUnlocked();
}

function renderChatAccessUI(){
  const inputRow = document.getElementById('chatInputRow');
  const hint = document.getElementById('chatLoginHint');
  if(!inputRow || !hint) return;
  if(canChat()){
    inputRow.style.display = 'flex';
    hint.style.display = 'none';
  } else {
    inputRow.style.display = 'none';
    hint.style.display = 'flex';
  }
}

function highlightMentions(escapedText){
  // escapedText đã qua escapeHtml() -> an toàn để chèn thêm span mà không lo XSS
  return escapedText.replace(/(^|\s)(@[^\s]+)/g, '$1<span class="chat-mention">$2</span>');
}

function linkifyUrls(escapedText){
  // escapedText đã qua escapeHtml() -> chèn thêm thẻ <a> vẫn an toàn
  const urlPattern = /((https?:\/\/|www\.)[^\s<]+)/g;
  return escapedText.replace(urlPattern, (match) => {
    const href = match.startsWith('http') ? match : `https://${match}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="chat-link">${match}</a>`;
  });
}

function renderChatMessages(){
  const wrap = document.getElementById('chatMessages');
  if(!wrap){
    console.warn('[chat] Không tìm thấy #chatMessages trong DOM');
    return;
  }
  const admin = isAdminUnlocked();
  const cur = getCurrentUser();

  console.log(`[chat] Đang render ${chatMessagesCache.length} tin nhắn`);

  if(chatMessagesCache.length === 0){
    wrap.innerHTML = '<div style="color:var(--muted);font-size:12.5px;text-align:center;padding:20px 0;">Chưa có tin nhắn nào. Hãy là người đầu tiên!</div>';
    return;
  }

  wrap.innerHTML = chatMessagesCache.map(m=>{
    const isAdminMsg = !!m.isAdmin;
    const isOwn = admin ? isAdminMsg : (!isAdminMsg && !!cur && !!m.username && m.username === cur.username);
    const delBtn = admin ? `<button class="chat-msg-del" title="Xoá tin nhắn" onclick="deleteChatMessageUI('${m.id}')">✕</button>` : '';
    const replyHtml = m.replyTo ? `
        <div class="chat-msg-reply">
          <span class="chat-msg-reply-name">${escapeHtml(m.replyTo.displayName||'Ẩn danh')}</span>
          <span class="chat-msg-reply-text">${escapeHtml(m.replyTo.text||'')}</span>
        </div>` : '';
    const formattedText = highlightMentions(linkifyUrls(escapeHtml(m.text||'')));
    return `
      <div class="chat-msg${isAdminMsg?' chat-msg-admin':''}${isOwn?' chat-msg-own':' chat-msg-other'}">
        ${delBtn}
        <div class="chat-msg-head">
          <span class="chat-msg-name">${escapeHtml(m.displayName||'Ẩn danh')}${isAdminMsg?' 🔓':''}</span>
          <span class="chat-msg-time">${formatChatTime(m.ts)}</span>
        </div>
        ${replyHtml}
        <div class="chat-msg-text">${formattedText}</div>
      </div>`;
  }).join('');

  if(!chatScrollListenerAttached){
    chatScrollListenerAttached = true;
    wrap.addEventListener('scroll', ()=>{
      chatStickToBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 60;
    });
  }

  if(chatStickToBottom){
    // Dùng setTimeout thay vì requestAnimationFrame: đảm bảo chắc chắn DOM đã
    // render/reflow xong (kể cả ảnh/emoji chưa load kịp) trước khi đo scrollHeight,
    // tránh trường hợp cuộn hụt không xuống hết cuối khung chat.
    setTimeout(()=>{ wrap.scrollTop = wrap.scrollHeight; }, 50);
  }
}

function initChat(){
  if(!db){
    console.error('[chat] Firestore chưa được khởi tạo, không thể lắng nghe chat.');
    return;
  }

  if(chatUnsub){
    console.log('[chat] Listener đã tồn tại, hủy listener cũ trước khi gắn lại...');
    try{
      chatUnsub();
    }catch(e){
      console.warn('[chat] Lỗi khi hủy listener cũ:', e);
    }
    chatUnsub = null;
  }

  try{
    console.log('[chat] Bắt đầu lắng nghe chat từ Firestore...');
    // QUAN TRỌNG: dùng limitToLast (không dùng limit) kết hợp orderBy('ts','asc')
    // để lấy 200 tin nhắn MỚI NHẤT nhưng vẫn trả về theo thứ tự tăng dần (cũ -> mới).
    // Nếu dùng limit(200) như trước đây, khi collection có hơn 200 tin nhắn thì
    // Firestore sẽ luôn trả về 200 tin CŨ NHẤT và mọi tin nhắn mới gửi sau đó sẽ
    // không bao giờ lọt vào kết quả -> UI đứng yên, không hiện tin nhắn mới.
    const q = query(collection(db, CHAT_COLLECTION), orderBy('ts', 'asc'), limitToLast(200));
    chatUnsub = onSnapshot(q, snap=>{
      console.log(`[chat] Nhận được ${snap.docs.length} tin nhắn từ Firestore`);
      chatMessagesCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderChatMessages();
    }, err=>{
      console.error('[chat] Lỗi lắng nghe chat:', err);
      chatUnsub = null; // cho phép thử khởi tạo lại lần sau
      showToast('Lỗi kết nối chat: ' + (err.message || 'không rõ nguyên nhân'));
    });
  }catch(e){
    console.error('[chat] Lỗi khởi tạo chat:', e);
    showToast('Không thể khởi tạo chat: ' + (e.message || 'không rõ nguyên nhân'));
  }
}

async function sendChatMessage(){
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text) return;
  if(!canChat()){ showToast('Bạn cần đăng nhập để gửi tin nhắn.'); return; }
  if(!db){ showToast('Chưa cấu hình Firebase.'); return; }
  const admin = isAdminUnlocked();
  const cur = getCurrentUser();
  const displayName = admin ? 'Admin' : ((cur && (cur.displayName || cur.username)) || 'Ẩn danh');
  const sendBtn = document.getElementById('chatSendBtn');
  sendBtn.disabled = true;
  input.value = '';
  chatStickToBottom = true; // tin của chính mình -> luôn cuộn xuống để thấy ngay
  try{
    await addDoc(collection(db, CHAT_COLLECTION), {
      text: text.slice(0,500),
      displayName,
      username: admin ? 'admin' : ((cur && cur.username) || ''),
      isAdmin: admin,
      ts: Date.now()
    });
  }catch(e){
    console.error(e);
    showToast('Gửi tin nhắn lỗi: ' + (e && e.message ? e.message : 'không rõ nguyên nhân'));
    input.value = text; // trả lại nội dung để người dùng không mất tin đã gõ
  }finally{
    sendBtn.disabled = false;
    input.focus();
  }
}
window.deleteChatMessageUI = async function(id){
  if(!isAdminUnlocked()) return;
  const ok = await askConfirm({title:'Xoá tin nhắn?', message:'Tin nhắn này sẽ bị xoá khỏi tường feedback.', okText:'Xoá', danger:true});
  if(!ok) return;
  try{ await deleteDoc(doc(db, CHAT_COLLECTION, id)); }
  catch(e){ console.error(e); showToast('Lỗi xoá tin nhắn.'); }
};

document.getElementById('chatSendBtn').addEventListener('click', sendChatMessage);
document.getElementById('chatInput').addEventListener('keydown', e=>{
  if(e.key === 'Enter'){ e.preventDefault(); sendChatMessage(); }
});
document.getElementById('chatLoginPromptBtn').addEventListener('click', ()=>openUserAuthModal('login'));

// ---------------- INIT ----------------
(async function init(){
  // Nếu đang đăng nhập là khách hàng, đồng bộ lại số dư V-coin mới nhất từ Firestore
  // (phòng trường hợp số dư đã đổi ở phiên/thiết bị khác kể từ lần đăng nhập gần nhất).
  if(isUserLoggedIn() && !isAdminUnlocked()){
    const cur = getCurrentUser();
    const freshUser = await loadUserDoc(cur.username);
    if(freshUser){
      setCurrentUser({username: freshUser.username, displayName: freshUser.displayName, vcoin: freshUser.vcoin||0, canManageFiles: !!freshUser.canManageFiles});
    }
  }
  renderAuthUI();
  updateVolumeIcon();
  collections = await loadCollections();
  renderCollectionChipsUI();
  await renderProducts();
  await renderProfile();
  await renderPlaylistAdmin();
  await renderShowcase();
  renderChatAccessUI();
  initChat();
})();
/* =====================================================================
GHI CHÚ BẢO MẬT - FIRESTORE RULES CHO users/{username} (BẮT BUỘC ĐỌC)
=========================================================================
Card "Cấp quyền quản lý file" (mục Hồ sơ, chỉ Admin thấy) cho phép Admin
ghi field "canManageFiles" vào doc Firestore "users/{username}". Kiểm tra
checkAdmin() trong app.js CHỈ ẩn/hiện giao diện và chặn ở phía trình
duyệt — đây không phải bảo mật thật. Nếu Firestore Rules đang mở quyền
ghi "users/*" cho bất kỳ ai, một người dùng thường (không phải Admin)
vẫn có thể mở Console (F12) và tự gọi updateDoc() để tự cấp quyền
"canManageFiles" cho chính mình.

Vì vậy, bạn BẮT BUỘC phải cập nhật Firestore Security Rules (Firebase
Console > Firestore Database > Rules) để chỉ những UID có trong
collection "admins" mới được ghi field "canManageFiles" (hoặc ghi bất kỳ
field nào) vào "users/{username}". Người dùng thường chỉ nên được phép
tự đọc/sửa MỘT VÀI field an toàn trên chính doc của họ (ví dụ đổi mật
khẩu), không được tự sửa "canManageFiles" hay "vcoin".

Đoạn rule mẫu bên dưới — bạn cần thay thế đoạn match "users/{username}"
đang có trong Rules thật của dự án bằng đoạn này (mình không truy cập
được Rules thật của bạn nên chỉ đưa mẫu tham khảo, hãy kiểm tra kỹ các
collection khác trước khi publish):

    match /users/{username} {
      // Ai cũng đọc được để phục vụ đăng nhập / kiểm tra trùng username.
      // Nếu muốn kín hơn, có thể giới hạn read chỉ cho chính user đó + admin,
      // nhưng khi đó cần đổi cách kiểm tra "username đã tồn tại" lúc đăng ký.
      allow read: if true;

      // Tạo tài khoản mới (đăng ký): cho phép tạo nếu chưa tồn tại,
      // và canManageFiles bắt buộc phải là false lúc tạo mới.
      allow create: if request.resource.data.canManageFiles == false;

      // Chỉ Admin (UID có trong collection "admins") mới được sửa
      // canManageFiles hoặc vcoin. Việc đổi các field khác (vd đổi mật khẩu)
      // cần rule riêng chặt chẽ hơn nếu bạn muốn cho user tự đổi.
      allow update: if exists(/databases/$(database)/documents/admins/$(request.auth.uid))
                    || (!('canManageFiles' in request.resource.data.diff(resource.data).affectedKeys())
                        && !('vcoin' in request.resource.data.diff(resource.data).affectedKeys()));

      allow delete: if exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

Sau khi dán/chỉnh Rules xong, nhớ bấm "Publish" trong Firebase Console.
Có thể dùng tab "Rules Playground" của Firebase để test thử trước khi
publish thật, đảm bảo user thường bị chặn ghi "canManageFiles" nhưng
Admin vẫn ghi được bình thường.
========================================================================= */
