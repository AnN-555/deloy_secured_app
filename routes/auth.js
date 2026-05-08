const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
  res.render('auth/login', { error: null, query: null });
});

router.get('/register', (req, res) => {
  res.render('auth/register', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = req.db;

  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  db.get(query, (err, user) => {
    if (user) {
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.email = user.email;
      return res.redirect('/user/dashboard');
    }
    res.render('auth/login', { error: 'Invalid credentials', query });
  });
});

router.post('/register', (req, res) => {
  const { username, password, email } = req.body;
  const db = req.db;

  db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, check) => {
    if (check) {
      return res.render('auth/register', { error: 'Username already exists' });
    }
    db.run(`INSERT INTO users (username, password, email, role, balance) VALUES (?, ?, ?, 'user', 100)`,
      [username, password, email], (err) => {
        if (err) return res.render('auth/register', { error: 'Registration failed' });
        res.redirect('/login');
      });
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// A2 - Forgot Password (vulnerable: predictable token, no expiry, user enumeration)
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { error: null, sent: false, username: null });
});

router.post('/forgot-password', (req, res) => {
  const { username } = req.body;
  const db = req.db;

  // Vulnerable: reveals whether username exists (user enumeration)
  const query = `SELECT * FROM users WHERE username = '${username}'`;
  db.get(query, (err, user) => {
    if (!user) {
      return res.render('auth/forgot-password', {
        error: 'Username not found',
        sent: false,
        username: null
      });
    }
    // Vulnerable: token = base64(username) — trivially reversible, no expiry, no DB storage
    const token = Buffer.from(username).toString('base64');
    const resetLink = `http://localhost:3000/reset-password?token=${token}`;
    // Token ẩn trong response header — chỉ thấy qua Burp Suite / DevTools Network
    res.set('X-Reset-Link', resetLink);
    res.render('auth/forgot-password', { error: null, sent: true, username });
  });
});

router.get('/reset-password', (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/forgot-password');
  // Vulnerable: decode token trực tiếp, không kiểm tra hợp lệ
  const username = Buffer.from(token, 'base64').toString('utf8');
  res.render('auth/reset-password', { token, username, error: null, success: null });
});

router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  const db = req.db;
  // Vulnerable: no expiry, no old password, no email verification, string concat
  const username = Buffer.from(token, 'base64').toString('utf8');
  const sql = `UPDATE users SET password = '${newPassword}' WHERE username = '${username}'`;
  db.run(sql, (err) => {
    res.render('auth/reset-password', {
      token, username,
      error: err ? err.message : null,
      success: err ? null : `Đã đổi mật khẩu cho tài khoản "${username}" thành công!`
    });
  });
});

module.exports = router;