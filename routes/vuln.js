const express = require('express');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

// Root → redirect to A1
router.get('/', requireAuth, (req, res) => {
  res.redirect('/vuln/sqli');
});

// A1 - SQL Injection
router.get('/sqli', requireAuth, (req, res) => {
  const sql = `SELECT id, username, email, role, balance FROM users WHERE username LIKE '%%'`;
  res.render('vuln/sqli', { query: '', sql, results: [], error: null });
});

router.post('/sqli', requireAuth, (req, res) => {
  const { search } = req.body;
  const db = req.db;
  const sql = `SELECT id, username, email, role, balance FROM users WHERE username LIKE '%${search}%'`;
  db.all(sql, [], (err, rows) => {
    res.render('vuln/sqli', {
      query: search, sql,
      results: err ? [] : (rows || []),
      error: err ? err.message : null
    });
  });
});

// A2 - Broken Authentication
router.get('/auth', requireAuth, (req, res) => {
  const sessionCookie = req.cookies['connect.sid'] || '(not found)';
  res.render('vuln/auth', {
    sessionData: {
      userId: req.session.userId,
      username: req.session.username,
      role: req.session.role,
      email: req.session.email
    },
    sessionCookie
  });
});

// No requireAuth - demonstrates unauthenticated brute force
router.post('/auth/bruteforce', (req, res) => {
  const { username, password } = req.body;
  const db = req.db;
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  db.get(query, (err, user) => {
    res.json({
      success: !!user && !err,
      query,
      message: user
        ? `SUCCESS — User: ${user.username} | Role: ${user.role} | Balance: $${user.balance}`
        : `FAILED — Invalid credentials`
    });
  });
});

// A3 - XSS
router.get('/xss', requireAuth, (req, res) => {
  res.render('vuln/xss', { output: null, name: '', comment: '' });
});

router.post('/xss', requireAuth, (req, res) => {
  const { name, comment } = req.body;
  const db = req.db;
  const userId = req.session.userId;
  const sql = `INSERT INTO reviews (user_id, name, comment, rating, created_at)
               VALUES (${userId}, '${name}', '${comment}', 5, datetime('now'))`;
  db.run(sql, (err) => { if (err) console.error(err); });
  const output = `Thank you <strong>${name}</strong> for your review!<br><em>${comment}</em>`;
  res.render('vuln/xss', { output, name, comment });
});

// A4 - IDOR: show current user's orders, access any order via /vuln/orders/:id
router.get('/idor', requireAuth, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM orders ORDER BY id DESC', [], (err, orders) => {
    res.render('vuln/idor', {
      orders: orders || [],
      currentUserId: req.session.userId
    });
  });
});


// A5 - Security Misconfiguration
router.get('/config', requireAuth, (req, res) => {
  const db = req.db;
  db.all('SELECT name, value FROM app_config', [], (err, configs) => {
    const responseHeaders = {
      'X-Powered-By': 'Express',
      'X-Frame-Options': '(missing)',
      'Content-Security-Policy': '(missing)',
      'X-Content-Type-Options': '(missing)',
      'Strict-Transport-Security': '(missing)',
      'Referrer-Policy': '(missing)'
    };
    res.render('vuln/config', { configs: configs || [], responseHeaders });
  });
});

// A6 - Sensitive Data Exposure (includes plaintext password column)
router.get('/data', requireAuth, (req, res) => {
  const db = req.db;
  db.all('SELECT id, username, password, email, role, balance FROM users', [], (err, users) => {
    res.render('vuln/data', { users: users || [] });
  });
});

module.exports = router;
