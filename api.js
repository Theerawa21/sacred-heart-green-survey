/* Public anonymous Apps Script bridge. No credentials belong in this file. */
(() => {
  'use strict';
  const methods = new Set(['getUnits','saveActivities','getActivityHistory']);
  let connection = null;
  function connect() {
    if (connection) return connection;
    connection = new Promise((resolve,reject) => {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const nonce = Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
      const requests = new Map(); let source = null, bridgeOrigin = null;
      const frame = document.createElement('iframe'); frame.hidden = true;
      frame.title = 'เชื่อมต่อระบบบันทึกข้อมูล'; frame.setAttribute('aria-hidden','true');
      const timer = setTimeout(()=>{
        if(source)return;
        window.removeEventListener('message',receive);frame.remove();connection=null;
        reject(new Error('เชื่อมต่อระบบไม่สำเร็จ กรุณาลองโหลดใหม่ หรือเปิดเว็บสำรอง'));
      },30000);
      function receive(event) {
        const data=event.data;
        if(!data || data.channel!=='SHG_V1' || data.nonce!==nonce || !/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin))return;
        if(data.type==='READY' && !source) {
          source=event.source;bridgeOrigin=event.origin;clearTimeout(timer);
          resolve({call(method,payload){
            return new Promise((yes,no)=>{
              const id=crypto.randomUUID();
              const timeout=setTimeout(()=>{requests.delete(id);no(new Error('ยังยืนยันผลไม่ได้ กรุณาตรวจข้อมูลย้อนหลังหรือติดต่อผู้ดูแลก่อนส่งซ้ำ'));},90000);
              requests.set(id,{yes,no,timeout});
              source.postMessage({channel:'SHG_V1',nonce,type:'CALL',id,method,payload},bridgeOrigin);
            });
          }});
        } else if(data.type==='RESULT' && event.source===source && event.origin===bridgeOrigin && requests.has(data.id)) {
          const pending=requests.get(data.id);requests.delete(data.id);clearTimeout(pending.timeout);
          if(data.ok===true)pending.yes(data.result);else pending.no(new Error(typeof data.result==='string'?data.result:'เชื่อมต่อระบบไม่สำเร็จ'));
        }
      }
      window.addEventListener('message',receive);
      frame.src=window.SHG_CONFIG.webAppUrl+'?view=bridge&nonce='+nonce;
      document.body.append(frame);
    });
    return connection;
  }
  window.SHG_API={async call(method,payload){
    if(!methods.has(method))throw new Error('คำขอไม่ถูกต้อง');
    // iOS privacy rules may block the cross-site Google iframe. Use the same form
    // as a top-level page before any data is entered; no save is retried or replayed.
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    if(ios && method==='getUnits'){
      window.location.replace(window.SHG_CONFIG.webAppUrl);
      return new Promise((resolve,reject)=>setTimeout(()=>reject(new Error('กรุณากด “เปิดแบบฟอร์มโดยตรง” เพื่อกรอกข้อมูลบน iPhone หรือ iPad')),10000));
    }
    return (await connect()).call(method,payload);
  }};
})();
