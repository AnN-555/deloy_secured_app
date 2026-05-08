const express = require('express');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).send('Access denied - Admin only');
  }
  next();
}

router.get('/users', requireAdmin, (req, res) => {
  const db = req.db;
  db.all('SELECT id, username, email, role, balance FROM users', [], (err, users) => {
    res.render('admin/users', { users });
  });
});

router.get('/drinks', requireAdmin, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM drinks ORDER BY category, name', [], (err, drinks) => {
    res.render('admin/drinks', { drinks });
  });
});

router.get('/drink/add', requireAdmin, (req, res) => {
  res.render('admin/drink-form', { drink: null, message: null });
});

router.post('/drink/add', requireAdmin, (req, res) => {
  const { name, price, category, image, stock } = req.body;
  const db = req.db;
  const sql = `INSERT INTO drinks (name, price, category, image, stock) VALUES ('${name}', ${price}, '${category}', '${image}', ${stock || 50})`;
  db.run(sql, (err) => {
    if (err) console.error(err);
    res.redirect('/admin/drinks');
  });
});

router.get('/drink/:id', requireAdmin, (req, res) => {
  const db = req.db;
  db.get('SELECT * FROM drinks WHERE id = ?', [req.params.id], (err, drink) => {
    res.render('admin/drink-form', { drink, message: null });
  });
});

router.post('/drink/:id', requireAdmin, (req, res) => {
  const { name, price, category, image, stock } = req.body;
  const db = req.db;
  const sql = `UPDATE drinks SET name='${name}', price=${price}, category='${category}', image='${image}', stock=${stock} WHERE id=${req.params.id}`;
  db.run(sql, (err) => {
    db.get('SELECT * FROM drinks WHERE id = ?', [req.params.id], (err, drink) => {
      res.render('admin/drink-form', { drink, message: 'Drink updated successfully!' });
    });
  });
});

router.post('/drink/:id/delete', requireAdmin, (req, res) => {
  const db = req.db;
  db.run('DELETE FROM drinks WHERE id = ?', [req.params.id], (err) => {
    res.redirect('/admin/drinks');
  });
});

router.get('/orders', requireAdmin, (req, res) => {
  const db = req.db;
  const sql = `SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.order_date DESC`;
  db.all(sql, [], (err, orders) => {
    res.render('admin/orders', { orders });
  });
});

router.get('/order/:id', requireAdmin, (req, res) => {
  const db = req.db;
  db.get('SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?', [req.params.id], (err, order) => {
    if (!order) return res.status(404).send('Order not found');
    db.all(`SELECT oi.*, d.name, d.image FROM order_items oi
            JOIN drinks d ON oi.drink_id = d.id
            WHERE oi.order_id = ?`, [order.id], (err, items) => {
      res.render('admin/order-detail', { order, items });
    });
  });
});

router.post('/order/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const db = req.db;
  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
    res.redirect('/admin/order/' + req.params.id);
  });
});

router.get('/user/:id', requireAdmin, (req, res) => {
  const db = req.db;
  db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, user) => {
    res.render('admin/editUser', { user, message: null });
  });
});

router.post('/user/:id', requireAdmin, (req, res) => {
  const { role, balance } = req.body;
  const db = req.db;
  db.run('UPDATE users SET role = ?, balance = ? WHERE id = ?', [role, balance, req.params.id], (err) => {
    db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, user) => {
      res.render('admin/editUser', { user, message: 'Updated successfully!' });
    });
  });
});

router.post('/user/:id/balance', requireAdmin, (req, res) => {
  const { balance } = req.body;
  const db = req.db;
  db.run('UPDATE users SET balance = ? WHERE id = ?', [balance, req.params.id], (err) => {
    res.redirect('/admin/users');
  });
});

router.post('/user/:id/delete', requireAdmin, (req, res) => {
  const db = req.db;
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
    res.redirect('/admin/users');
  });
});

router.get('/settings', requireAdmin, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM app_config', [], (err, configs) => {
    res.render('admin/settings', { configs, message: null });
  });
});

router.post('/settings', requireAdmin, (req, res) => {
  const db = req.db;
  const { name, value } = req.body;
  db.run('INSERT OR REPLACE INTO app_config (name, value) VALUES (?, ?)', [name, value], (err) => {
    db.all('SELECT * FROM app_config', [], (err, configs) => {
      res.render('admin/settings', { configs, message: 'Config updated!' });
    });
  });
});

router.get('/logs', requireAdmin, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM logs ORDER BY id DESC LIMIT 50', [], (err, logs) => {
    res.render('admin/logs', { logs: logs || [] });
  });
});

module.exports = router;