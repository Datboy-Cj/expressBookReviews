const express = require('express');
const session = require('express-session');
const { randomBytes } = require('node:crypto');
const app = express();
app.set('json spaces', 2);
app.use(express.json({ limit: '16kb' }));
app.use('/customer', session({
  secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 3600000 }
}));
app.use('/customer', require('./router/auth_users.js').authenticated);
app.use('/', require('./router/general.js').general);
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body.' });
  console.error(error.message);
  res.status(500).json({ message: 'Internal server error.' });
});
if (require.main === module) {
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, '127.0.0.1', () => console.log(`Book review server running at http://127.0.0.1:${port}`));
}
module.exports = app;
