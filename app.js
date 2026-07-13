import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// ---------------- CONFIG ----------------
const ADMIN_USERNAME = "adminbuivinh0804";
const ADMIN_PASSWORD = "hmm_0804";

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
try{
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}catch(e){
  console.error('Chưa cấu hình Firebase đúng cách:', e);
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
  if(username === normalizeUsername(ADMIN_USERNAME)){
    errEl.textContent = 'Tên đăng nhập này đã được sử dụng.';
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
      createdAt: Date.now()
    };
    const ok = await saveUserDoc(userDoc);
    btn.disabled = false;
    if(!ok) return;
    setCurrentUser({username, displayName, vcoin: 0});
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

  // 1) Kiểm tra trước xem có phải tài khoản Quản trị (Admin) không.
  //    So khớp chính xác hoa/thường với thông tin admin cứng trong code.
  if(rawUsername === ADMIN_USERNAME && password === ADMIN_PASSWORD){
    localStorage.setItem('siteAdminUnlocked', '1');
    setCurrentUser({username: ADMIN_USERNAME, displayName: 'Quản trị viên'});
    renderAuthUI();
    closeUserAuthModal();
    btn.disabled = false;
    showToast('Đã đăng nhập với quyền Admin.');
    applyFiltersAndRender();
    renderCollectionChipsUI();
    renderDashboard();
    return;
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
    setCurrentUser({username: userDoc.username, displayName: userDoc.displayName, vcoin: userDoc.vcoin||0});
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
  if(!checkAdmin()) return;
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
  if(!checkAdmin()) return;
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
  if(!checkAdmin() || !editingId) return;
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
  if(!checkAdmin()) return;
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
  return localStorage.getItem('siteAdminUnlocked') === '1';
}
// Nút "loginBtn" duy nhất trên nav giờ dùng chung cho cả Admin lẫn khách hàng:
// - Chưa đăng nhập gì cả -> mở modal đăng nhập/đăng ký chung.
// - Đã đăng nhập (Admin hoặc khách hàng) -> bấm để đăng xuất khỏi vai trò hiện tại.
document.getElementById('loginBtn').addEventListener('click', ()=>{
  if(isAdminUnlocked()){
    localStorage.removeItem('siteAdminUnlocked');
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

document.getElementById('openAddBtn').addEventListener('click', ()=>{
  if(!checkAdmin()) return;
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
let shuffleOn = false;
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

// ---------------- INIT ----------------
(async function init(){
  // Nếu đang đăng nhập là khách hàng, đồng bộ lại số dư V-coin mới nhất từ Firestore
  // (phòng trường hợp số dư đã đổi ở phiên/thiết bị khác kể từ lần đăng nhập gần nhất).
  if(isUserLoggedIn() && !isAdminUnlocked()){
    const cur = getCurrentUser();
    const freshUser = await loadUserDoc(cur.username);
    if(freshUser){
      setCurrentUser({username: freshUser.username, displayName: freshUser.displayName, vcoin: freshUser.vcoin||0});
    }
  }
  renderAuthUI();
  updateVolumeIcon();
  collections = await loadCollections();
  renderCollectionChipsUI();
  await renderProducts();
  await renderProfile();
  await renderPlaylistAdmin();
})();