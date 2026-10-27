/* Anonymous Apps Script transport, without cross-site frames or login cookies. */
(() => {
  'use strict';
  const endpoint=window.SHG_CONFIG.webAppUrl;
  const methods=new Set(['getUnits','getActivityHistory','saveActivities']);
  function randomId(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');}
  function read(method,payload,token){
    return new Promise((resolve,reject)=>{
      const callback='SHG_cb_'+randomId(), script=document.createElement('script');
      const url=new URL(endpoint);url.searchParams.set('api',method);url.searchParams.set('callback',callback);
      if(payload)url.searchParams.set('payload',JSON.stringify(payload));
      if(token)url.searchParams.set('token',token);
      let finished=false;
      const clean=()=>{finished=true;clearTimeout(timeout);script.remove();delete window[callback];};
      const timeout=setTimeout(()=>{if(!finished){clean();reject(new Error('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่'));}},20000);
      window[callback]=response=>{if(finished)return;clean();if(response && response.ok===true)resolve(response.result);else reject(new Error(response && response.error || 'เชื่อมต่อระบบไม่สำเร็จ'));};
      script.onerror=()=>{if(finished)return;clean();reject(new Error('เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่'));};
      script.src=url.toString();document.head.append(script);
    });
  }
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function save(payload){
    const token=randomId();
    // Do not resend writes. An opaque response must never be treated as saved.
    fetch(endpoint,{method:'POST',mode:'no-cors',credentials:'omit',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({method:'saveActivities',token,payload})}).catch(()=>{});
    const deadline=Date.now()+100000;
    while(Date.now()<deadline){
      await wait(1500);
      let receipt;try{receipt=await read('receipt',null,token);}catch(error){continue;}
      if(receipt && receipt.state==='done'){
        if(receipt.ok===true)return receipt.result;
        throw new Error(receipt.error || 'บันทึกข้อมูลไม่สำเร็จ');
      }
    }
    throw new Error('ยังยืนยันผลการบันทึกไม่ได้ กรุณาตรวจข้อมูลย้อนหลังหรือติดต่อผู้ดูแลก่อนส่งซ้ำ');
  }
  window.SHG_API={call(method,payload){
    if(!methods.has(method))return Promise.reject(new Error('คำขอไม่ถูกต้อง'));
    return method==='saveActivities'?save(payload):read(method,payload);
  }};
})();
