const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
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
    res.render('auth/login', { error: 'Invalid credentials' });
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

module.exports = router;