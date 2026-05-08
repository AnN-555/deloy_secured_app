const express = require('express');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

router.get('/sqli', requireAuth, (req, res) => {
  res.render('vuln/sqli', { results: [], query: '' });
});

router.post('/sqli', requireAuth, (req, res) => {
  const { search } = req.body;
  const db = req.db;
  const sql = `SELECT id, username, email, role, balance FROM users WHERE username LIKE '%${search}%'`;
  db.all(sql, [], (err, results) => {
    if (err) results = [];
    res.render('vuln/sqli', { results, query: search });
  });
});

router.get('/xss', requireAuth, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM reviews ORDER BY id DESC LIMIT 10', [], (err, reviews) => {
    res.render('vuln/xss', { output: '', name: '', reviews: reviews || [] });
  });
});

router.post('/xss', requireAuth, (req, res) => {
  const { name, comment } = req.body;
  const db = req.db;

  const sql = `INSERT INTO reviews (user_id, name, comment, rating, created_at)
               VALUES (${req.session.userId}, '${name}', '${comment}', 5, datetime('now'))`;
  db.run(sql, (err) => {
    if (err) console.error(err);
  });

  res.render('vuln/xss', {
    output: `Thank you <strong>${name}</strong> for your review!<br><em>${comment}</em>`,
    name,
    reviews: []
  });
});

router.get('/idor', requireAuth, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM orders WHERE user_id = ?', [req.session.userId], (err, orders) => {
    res.render('vuln/idor', { orders, allOrders: [] });
  });
});

router.get('/orders/all', requireAuth, (req, res) => {
  const db = req.db;
  const sql = `SELECT o.*, u.username FROM orders o
               JOIN users u ON o.user_id = u.id
               WHERE o.user_id = ${req.session.userId}
               ORDER BY o.order_date DESC`;
  db.all(sql, [], (err, orders) => {
    res.render('vuln/idor', { orders: orders || [], allOrders: [] });
  });
});

router.get('/config', requireAuth, (req, res) => {
  const db = req.db;
  db.all('SELECT name, value FROM app_config', [], (err, configs) => {
    if (err || !configs || configs.length === 0) {
      configs = [
        { name: 'db_host', value: 'localhost' },
        { name: 'db_user', value: 'root' },
        { name: 'db_pass', value: 'password123' },
        { name: 'api_key', value: 'sk_live_secret_key_12345' },
        { name: 'admin_email', value: 'admin@milktea.com' },
        { name: 'debug_mode', value: 'true' }
      ];
    }
    res.render('vuln/config', { configs });
  });
});

router.get('/data', requireAuth, (req, res) => {
  const db = req.db;
  const sql = `SELECT id, username, email, role, balance FROM users`;
  db.all(sql, [], (err, users) => {
    if (err) users = [];
    res.render('vuln/data', { users });
  });
});

router.get('/orders/:id', requireAuth, (req, res) => {
  const db = req.db;
  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, order) => {
    if (!order) return res.status(404).send('Order not found');
    res.render('vuln/order-detail', { order });
  });
});

module.exports = router;