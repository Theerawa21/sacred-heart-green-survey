# พระหฤทัยรักษ์โลก

เว็บสำรวจกิจกรรมสิ่งแวดล้อม หน้าเว็บอยู่บน GitHub Pages และบันทึกข้อมูลผ่าน Google Apps Script ลง Google Sheets เดิม

## แก้หน้าเว็บผ่าน GitHub

- `index.html` — ข้อความ โครงสร้างหน้าเว็บ และช่องกรอกข้อมูล
- `styles.css` — สี ตัวอักษร ขนาดและรูปแบบมือถือ
- `app.js` — การเลือกหน่วยงาน ชื่อผู้กรอก กิจกรรมและข้อมูลย้อนหลัง
- `config.js` — URL เว็บแอปสาธารณะ ไม่มีรหัสผ่านหรือ API key
- `api.js` — เชื่อมต่อ Apps Script ด้วย postMessage โดยตรวจ origin/source/nonce และจำกัดฟังก์ชันที่เรียก

แก้ไฟล์แล้ว Commit ไป main เว็บ Pages จะเผยแพร่รุ่นใหม่อัตโนมัติ ใช้ Settings → Pages → Deploy from a branch → main → /(root)

## ฝั่งฐานข้อมูล

โค้ดเซิร์ฟเวอร์จัดการแยกใน Google Apps Script ไม่รวมไว้ใน repository สาธารณะนี้ หากแก้เซิร์ฟเวอร์ต้อง Deploy → Manage deployments → New version ด้วย ไม่อัปเดตเซิร์ฟเวอร์โดยการ Commit หน้าเว็บอย่างเดียว

Bridge ยอมรับข้อความจาก `https://theerawa21.github.io` และเรียกได้เฉพาะ getUnits/saveActivities/getActivityHistory ใช้ nonce สุ่มต่อการเชื่อมต่อ ไม่มีสิทธิ์แก้ไขหรือลบข้อมูลผ่านเว็บ ทะเบียนและประวัติยังอ่านจาก Google Sheets ไม่ได้ฝังข้อมูลใน repository

ต้องเปิดผ่าน GitHub Pages จริง การเปิดไฟล์ในเครื่องจะถูกปฏิเสธ origin หากเบราว์เซอร์บล็อก iframe ของ Google ให้ใช้ปุ่ม “เปิดเว็บสำรอง” ซึ่งใช้ฐานข้อมูลเดียวกัน

ไม่ใส่สำเนาข้อมูลผู้กรอก รหัสผ่าน OAuth tokens หรือไฟล์ฐานข้อมูลใน repository นี้
