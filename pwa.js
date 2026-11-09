/* PWA: service worker + install popup (Android/Chrome prompt, iOS instructions) */
(function () {
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) return;
  const KEY = 'kc-install-dismissed';
  try { const t = +localStorage.getItem(KEY); if (t && Date.now() - t < 3 * 864e5) return; } catch (e) {}

  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  const isSafari = isIOS && !/crios|fxios|edgios/i.test(ua);
  let deferred = null;

  const css = `
  .kci-back{position:fixed;inset:0;background:rgba(5,8,28,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:100;opacity:0;transition:opacity .3s}
  .kci{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:440px;margin:0 auto;z-index:101;background:#0B1033;color:#EEF0FA;border:1px solid rgba(255,255,255,.1);border-radius:28px;padding:22px 20px 18px;font-family:'Readex Pro',sans-serif;direction:rtl;box-shadow:0 30px 80px -20px rgba(0,0,0,.7);transform:translateY(120%);transition:transform .45s cubic-bezier(.2,.8,.2,1);overflow:hidden}
  .kci.on{transform:none}.kci-back.on{opacity:1}
  .kci:before{content:"";position:absolute;inset:0 0 auto auto;width:45%;height:100%;background:repeating-linear-gradient(180deg,rgba(242,101,34,.14) 0 12px,transparent 12px 22px);clip-path:polygon(40% 0,100% 0,100% 100%,0 100%);pointer-events:none}
  .kci-h{display:flex;gap:14px;align-items:center;position:relative;padding-left:40px}
  .kci-h img{width:60px;height:60px;border-radius:16px;box-shadow:0 10px 24px -8px rgba(0,0,0,.6)}
  .kci-t{font-size:19px;font-weight:600;line-height:1.3}.kci-t span{color:#F26522}
  .kci-s{font-size:12.5px;color:#A9AFD6;margin-top:2px;line-height:1.6}
  .kci-f{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 4px;position:relative}
  .kci-f span{font-size:11.5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);padding:5px 11px;border-radius:99px;color:#DDE0F4}
  .kci-steps{position:relative;margin-top:14px;display:flex;flex-direction:column;gap:10px;font-size:13.5px}
  .kci-steps div{display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.05);border-radius:14px;padding:10px 12px}
  .kci-steps b{width:26px;height:26px;flex-shrink:0;border-radius:50%;background:#F26522;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600}
  .kci-steps svg{vertical-align:-5px;margin:0 3px}
  .kci-a{display:flex;gap:8px;margin-top:16px;position:relative}
  .kci-a button{font-family:inherit;border:0;border-radius:14px;min-height:50px;font-size:15px;cursor:pointer;transition:transform .15s}
  .kci-a button:active{transform:scale(.97)}
  .kci-go{flex:1;background:#F26522;color:#fff;font-weight:600;box-shadow:0 12px 26px -10px rgba(242,101,34,.9)}
  .kci-no{background:rgba(255,255,255,.07);color:#C9CDE8;padding:0 18px}
  .kci-x{position:absolute;top:14px;left:14px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.07);color:#fff;font-size:18px;cursor:pointer;z-index:2}`;

  const shareIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4DA3FF" stroke-width="2" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  const addIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

  function show(mode) {
    if (document.querySelector('.kci')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const back = document.createElement('div'); back.className = 'kci-back';
    const box = document.createElement('div'); box.className = 'kci'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'تثبيت التطبيق');
    const body = mode === 'ios'
      ? `<div class="kci-steps"><div><b>1</b><span>اضغط زر المشاركة ${shareIcon} في أسفل Safari</span></div><div><b>2</b><span>اختر «إضافة إلى الشاشة الرئيسية» ${addIcon}</span></div><div><b>3</b><span>اضغط «إضافة» — وسيظهر التطبيق بين تطبيقاتك</span></div></div>
         <div class="kci-a"><button class="kci-go" data-x>فهمت</button></div>`
      : mode === 'ios-other'
      ? `<div class="kci-steps"><div><b>!</b><span>لتثبيت التطبيق على آيفون، افتح هذا الرابط في متصفح Safari ثم اختر «إضافة إلى الشاشة الرئيسية».</span></div></div>
         <div class="kci-a"><button class="kci-go" data-x>حسناً</button></div>`
      : `<div class="kci-a"><button class="kci-go" data-install>تثبيت التطبيق</button><button class="kci-no" data-x>لاحقاً</button></div>`;
    box.innerHTML = `<button class="kci-x" data-x aria-label="إغلاق">×</button>
      <div class="kci-h"><img src="/icons/icon-192.png" alt=""><div><div class="kci-t">ثبّت <span>كرامة كير</span> على هاتفك</div><div class="kci-s">وصول أسرع لسجلات اللاعبين والمواعيد، بشاشة كاملة ودون فتح المتصفح.</div></div></div>
      <div class="kci-f"><span>فتح بلمسة واحدة</span><span>يعمل مع ضعف الشبكة</span><span>بلا متجر تطبيقات</span></div>${body}`;
    document.body.append(back, box);
    requestAnimationFrame(() => requestAnimationFrame(() => { back.classList.add('on'); box.classList.add('on'); }));
    const close = (remember) => {
      if (remember) try { localStorage.setItem(KEY, Date.now()); } catch (e) {}
      box.classList.remove('on'); back.classList.remove('on'); setTimeout(() => { box.remove(); back.remove(); }, 450);
    };
    back.onclick = () => close(true);
    box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => close(true));
    const ib = box.querySelector('[data-install]');
    if (ib) ib.onclick = async () => { if (!deferred) return close(false); deferred.prompt(); const r = await deferred.userChoice; deferred = null; close(r.outcome !== 'accepted'); };
  }

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; setTimeout(() => show('prompt'), 2500); });
  window.addEventListener('appinstalled', () => { const b = document.querySelector('.kci-x'); b && b.click(); });
  if (isIOS) setTimeout(() => show(isSafari ? 'ios' : 'ios-other'), 2500);
})();
