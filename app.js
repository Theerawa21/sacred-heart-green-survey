(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('survey-form'), fields = $('form-fields'), zone = $('zone'), unit = $('unit');
  const activities = $('activities'), notice = $('notice');
  const reporter = $('reporter-name');
  let historyVersion = 0, historyPage = 0;
  let registry = [], maxBatch = 30, maxName = 200, nextId = 0, saving = false, loading = false;
  const isPreview = !!window.SHG_PREVIEW;
  if (isPreview) $('demo-banner').hidden = false;

  function show(message, kind = 'error', focus = true) {
    notice.textContent = message;
    notice.className = 'notice ' + kind;
    notice.hidden = false;
    if (focus) notice.focus();
  }
  function clearNotice() { notice.hidden = true; notice.textContent = ''; }
  function normalize(text) { return text.normalize('NFC').replace(/\s+/gu, ' ').trim(); }
  function callServer(method, payload) {
    if (window.SHG_API) return window.SHG_API.call(method, payload);
    if (isPreview) return window.SHG_PREVIEW.call(method, payload);
    return new Promise((resolve, reject) => {
      if (!window.google || !google.script || !google.script.run) {
        reject(new Error('กรุณาเปิดผ่านลิงก์เว็บแอป Google Apps Script ที่ผู้ดูแลส่งให้')); return;
      }
      const runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
      if (method === 'getUnits') runner.getUnits();
      else if (method === 'getActivityHistory') runner.getActivityHistory(payload);
      else runner.saveActivities(payload);
    });
  }
  function addActivity(focus = true) {
    if (activities.children.length >= maxBatch) return;
    const id = 'activity-' + (++nextId);
    const row = document.createElement('div'); row.className = 'activity-row';
    const heading = document.createElement('div'); heading.className = 'activity-label';
    const label = document.createElement('label'); label.htmlFor = id;
    const counter = document.createElement('span'); counter.className = 'activity-counter'; counter.id = id + '-counter'; counter.textContent = '0 / ' + maxName;
    heading.append(label, counter);
    const wrap = document.createElement('div'); wrap.className = 'activity-input-wrap';
    const input = document.createElement('input'); input.id = id; input.type = 'text'; input.maxLength = maxName;
    input.placeholder = 'เช่น กิจกรรมคัดแยกขยะ'; input.autocomplete = 'off'; input.setAttribute('aria-describedby',counter.id);
    input.addEventListener('input', () => { counter.textContent = input.value.length + ' / ' + maxName; input.removeAttribute('aria-invalid'); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-button'; remove.textContent = '×';
    remove.addEventListener('click', () => {
      if (saving) return;
      const adjacent = row.previousElementSibling || row.nextElementSibling;
      row.remove(); if (!activities.children.length) addActivity(false); renumber();
      (adjacent ? adjacent.querySelector('input') : activities.querySelector('input')).focus();
    });
    wrap.append(input, remove); row.append(heading, wrap); activities.append(row); renumber();
    if (focus) input.focus();
  }
  function renumber() {
    Array.from(activities.children).forEach((row, i) => {
      row.querySelector('label').textContent = 'กิจกรรมที่ ' + (i + 1);
      row.querySelector('button').setAttribute('aria-label', 'ลบกิจกรรมที่ ' + (i + 1));
    });
    $('add-activity').disabled = saving || activities.children.length >= maxBatch;
  }
  function filterUnits() {
    resetHistory();
    unit.replaceChildren(new Option(zone.value ? 'เลือกหน่วยงาน' : 'กรุณาเลือกเขตก่อน', ''));
    const matches = registry.filter(u => u.zone === zone.value);
    matches.forEach(u => unit.add(new Option(u.name, u.id)));
    unit.disabled = !matches.length;
    $('unit-hint').textContent = !zone.value ? 'รายชื่อจะแสดงตามเขตที่เลือก' : matches.length
      ? 'พบ ' + matches.length + ' หน่วยงานในเขตนี้'
      : 'กลุ่มนี้ยังไม่มีรายชื่อหน่วยงานที่เปิดใช้งาน กรุณาติดต่อผู้ดูแล';
    zone.removeAttribute('aria-invalid'); unit.removeAttribute('aria-invalid');
  }
  async function loadUnits() {
    if (loading || saving) return;
    loading = true; fields.disabled = true; $('loading').hidden = false; $('retry-load').hidden = true; clearNotice();
    try {
      const data = await callServer('getUnits');
      if (!data || !Array.isArray(data.units) || !Array.isArray(data.zones)) throw new Error('ข้อมูลทะเบียนไม่สมบูรณ์ กรุณาลองโหลดใหม่');
      registry = data.units; maxBatch = data.maxBatch || 30; maxName = data.maxName || 200;
      const previousZone = zone.value;
      zone.replaceChildren(new Option('เลือกเขตที่สังกัด', ''));
      data.zones.forEach(z => zone.add(new Option(z, z)));
      if (data.zones.includes(previousZone)) zone.value = previousZone;
      filterUnits(); fields.disabled = false;
    } catch (error) {
      show(error.message || 'โหลดรายชื่อไม่สำเร็จ กรุณาลองใหม่', 'error', false); $('retry-load').hidden = false;
    } finally { loading = false; $('loading').hidden = true; }
  }
  function validate() {
    if (!zone.value) { zone.setAttribute('aria-invalid','true'); zone.focus(); throw new Error('กรุณาเลือกเขตที่สังกัด'); }
    if (!unit.value || !registry.some(u => u.id === unit.value && u.zone === zone.value)) {
      unit.setAttribute('aria-invalid','true'); unit.focus(); throw new Error('กรุณาเลือกหน่วยงาน หากไม่มีรายชื่อให้ติดต่อผู้ดูแล');
    }
    const reporterName = normalize(reporter.value);
    if (!reporterName || reporterName.length > 120) { reporter.setAttribute('aria-invalid','true'); reporter.focus(); throw new Error('กรุณากรอกชื่อผู้กรอก ไม่เกิน 120 ตัวอักษร'); }
    const names = [], seen = new Set();
    for (const input of activities.querySelectorAll('input')) {
      const name = normalize(input.value); if (!name) continue;
      if (name.length > maxName) { input.focus(); throw new Error('ชื่อกิจกรรมต้องไม่เกิน 200 ตัวอักษร'); }
      if (seen.has(name)) { input.setAttribute('aria-invalid','true'); input.focus(); throw new Error('กิจกรรมนี้ได้รับการบันทึกแล้วในรายการที่กำลังส่ง: ' + name + ' กรุณาลบรายการซ้ำ'); }
      names.push(name); seen.add(name);
    }
    if (!names.length) { activities.querySelector('input').focus(); throw new Error('กรุณากรอกกิจกรรมอย่างน้อย 1 รายการ'); }
    return { unitId: unit.value, reporterName: reporterName, activities: names };
  }
  function resetHistory() {
    historyVersion++; historyPage = 0; $('history-panel').hidden = true;
    $('history-list').replaceChildren(); $('history-more').hidden = true;
    $('view-history').disabled = false;
  }
  async function loadHistory(page = 0) {
    if (saving || loading) return;
    if (!zone.value || !unit.value) { show('กรุณาเลือกเขตและหน่วยงานเพื่อดูข้อมูลย้อนหลัง'); return; }
    const selectedUnit = unit.value, version = ++historyVersion;
    $('history-panel').hidden = false; $('history-title').textContent = 'ข้อมูลย้อนหลัง';
    $('history-status').textContent = 'กำลังโหลดข้อมูลย้อนหลัง…';
    $('view-history').disabled = true; $('history-more').disabled = true;
    if (!page) $('history-list').replaceChildren();
    try {
      const result = await callServer('getActivityHistory', {unitId:selectedUnit, page:page});
      if (version !== historyVersion || selectedUnit !== unit.value) return;
      if (!result || result.unitId !== selectedUnit || !Array.isArray(result.items)) throw new Error('ข้อมูลย้อนหลังไม่สมบูรณ์ กรุณาลองใหม่');
      $('history-title').textContent = 'ข้อมูลย้อนหลัง — ' + result.unitName;
      $('history-status').textContent = result.total ? 'บันทึกแล้วทั้งหมด ' + result.total + ' กิจกรรม · เรียงจากรายการล่าสุด' : 'หน่วยงานนี้ยังไม่มีข้อมูลกิจกรรมที่บันทึกไว้';
      result.items.forEach(item => {
        const row = document.createElement('li'), name = document.createElement('p'), meta = document.createElement('p');
        name.className = 'history-name'; name.textContent = item.name;
        meta.className = 'history-meta';
        const date = item.createdAt ? new Date(item.createdAt) : null;
        const when = date && !isNaN(date.getTime()) ? new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(date) : 'ไม่ระบุวันที่';
        meta.textContent = 'ผู้กรอก: ' + (item.reporterName || 'ไม่ระบุ') + ' · ' + when;
        row.append(name,meta); $('history-list').append(row);
      });
      historyPage = result.page; $('history-more').hidden = !result.hasMore;
    } catch(error) {
      if (version === historyVersion) $('history-status').textContent = error.message || 'โหลดข้อมูลย้อนหลังไม่สำเร็จ กรุณากดดูข้อมูลย้อนหลังอีกครั้ง';
    } finally {
      if (version === historyVersion) { $('view-history').disabled = false; $('history-more').disabled = false; }
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (saving || loading) return; clearNotice();
    let payload;
    try { payload = validate(); } catch (error) { show(error.message, 'error', false); return; }
    resetHistory(); saving = true; fields.disabled = true; $('view-history').disabled = true; form.setAttribute('aria-busy','true'); $('save-label').textContent = 'กำลังบันทึกข้อมูล…';
    show('กำลังส่งข้อมูล กรุณารอการยืนยันจากระบบ', 'info', false);
    // Do not cancel a write on a client timeout: the server may still commit it.
    const slow = setTimeout(() => { if (saving) show('ระบบใช้เวลานานกว่าปกติ กรุณารอการยืนยัน หากปิดหน้านี้ให้ติดต่อผู้ดูแลเพื่อตรวจข้อมูลก่อนส่งใหม่', 'info', false); }, 25000);
    try {
      const result = await callServer('saveActivities', payload);
      if (!result || result.ok !== true || result.count !== payload.activities.length) throw new Error('ยังยืนยันการบันทึกไม่ได้ กรุณาติดต่อผู้ดูแลก่อนส่งซ้ำ');
      activities.replaceChildren(); addActivity(false);
      show(result.message + '\nบันทึก ' + result.count + ' กิจกรรมแล้ว กด “ดูข้อมูลย้อนหลัง” เพื่อตรวจรายการ หรือเลือกเขตและหน่วยงานเดิมเมื่อกลับมาใช้งานครั้งถัดไป', 'success');
    } catch (error) {
      show(error.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองส่งรายการเดิมอีกครั้ง หากแจ้งว่าซ้ำให้ติดต่อผู้ดูแล');
    } finally {
      clearTimeout(slow); saving = false; fields.disabled = false; form.removeAttribute('aria-busy');
      $('save-label').textContent = 'บันทึกข้อมูล'; $('view-history').disabled = false; renumber();
    }
  });
  zone.addEventListener('change', () => { clearNotice(); filterUnits(); });
  unit.addEventListener('change', () => {clearNotice(); resetHistory();});
  reporter.addEventListener('input', () => reporter.removeAttribute('aria-invalid'));
  $('view-history').addEventListener('click', () => loadHistory(0));
  $('history-more').addEventListener('click', () => loadHistory(historyPage + 1));
  $('add-activity').addEventListener('click', () => { if (!saving) addActivity(); });
  $('retry-load').addEventListener('click', loadUnits);
  window.addEventListener('beforeunload', event => { if(saving) {event.preventDefault(); event.returnValue = ''; } });
  addActivity(false); loadUnits();
})();

/* Form readiness indicator: never represents server save status. */
(() => {
  'use strict';
  const form=document.getElementById('survey-form');
  if(!form)return;
  const panel=document.createElement('div');panel.className='form-progress';
  const heading=document.createElement('div');heading.className='progress-heading';
  const title=document.createElement('span');title.textContent='ความพร้อมของข้อมูล';
  const count=document.createElement('span');count.className='progress-count';
  const track=document.createElement('div');track.className='progress-track';
  track.setAttribute('role','progressbar');track.setAttribute('aria-label','จำนวนส่วนที่กรอกครบ');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','4');
  const fill=document.createElement('span');fill.className='progress-fill';track.append(fill);
  const help=document.createElement('p');help.className='progress-help';help.textContent='เลือกเขต · เลือกหน่วยงาน · ระบุชื่อ · เพิ่มกิจกรรม';
  heading.append(title,count);panel.append(heading,track,help);form.before(panel);
  function update(){
    const zone=document.getElementById('zone'),unit=document.getElementById('unit'),reporter=document.getElementById('reporter-name'),activities=document.getElementById('activities');
    const states=[!!zone.value,!!unit.value,!!reporter.value.trim(),Array.from(activities.querySelectorAll('input')).some(input=>!!input.value.trim())];
    const total=states.filter(Boolean).length;
    count.textContent=total+' / 4 ส่วน';fill.style.width=(total*25)+'%';track.setAttribute('aria-valuenow',String(total));
    help.textContent=total===4?'กรอกครบแล้ว กรุณาตรวจสอบข้อมูลและกดบันทึก':'เลือกเขต · เลือกหน่วยงาน · ระบุชื่อ · เพิ่มกิจกรรม';
    help.classList.toggle('completion-mark',total===4);
    [zone,unit,reporter,activities].forEach((element,i)=>element.closest('.field-section')?.classList.toggle('is-complete',states[i]));
  }
  form.addEventListener('input',update);form.addEventListener('change',update);
  new MutationObserver(update).observe(document.getElementById('activities'),{childList:true});
  update();
})();
