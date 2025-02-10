const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const session = require('express-session');
const bodyParser = require('body-parser');

dotenv.config(); // Load environment variables

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json()); // To parse JSON data

// Set up session handling
app.use(
  session({
    secret: 'your-secret-key', // Change this to a random string for security
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true if you're using https
    },
  })
);

// Serve static files (index.html, dashboard.html, inspections.html, inspection-form.html) from "public"
app.use(express.static(path.join(__dirname, 'public')));

// Route for serving the login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for serving the dashboard page
app.get('/dashboard', (req, res) => {
  if (req.session.user) {
    console.log('Session User:', req.session.user); // Check if session user is set
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    console.log('No session user found');
    res.redirect('/'); // Redirect to login if not logged in
  }
});

// Route to fetch inspections for a given site
app.get('/site/:name', async (req, res) => {
  if (!req.session.user) {
    console.log('User not logged in, logging out');
    return res.redirect('/'); // Ensure user is logged in before proceeding
  }

  const siteName = req.params.name.trim();
  try {
    const result = await pool.query('SELECT * FROM inspections WHERE TRIM(site) ILIKE $1', [siteName]);
    console.log('Inspections for site:', result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inspections for site:', err);
    res.status(500).send('Error fetching inspections');
  }
});

// Simple login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();

  console.log(`Attempting login with username: ${trimmedUsername} and password: ${trimmedPassword}`);

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [trimmedUsername, trimmedPassword]);
    console.log('Query Result:', result.rows);

    if (result.rows.length > 0) {
      req.session.user = result.rows[0];
      console.log('Session User:', req.session.user);
      res.redirect('/dashboard');
    } else {
      res.send('Invalid credentials. Please try again.');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error with the login request.');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Error logging out.');
    }
    res.redirect('/');
  });
});

// Route to get all sites (returns JSON with site_id and site_name)
app.get('/sites', async (req, res) => {
  try {
    const result = await pool.query('SELECT site_id, site_name FROM sites');
    console.log('Fetched sites:', result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sites:', err);
    res.status(500).send('Error fetching sites');
  }
});

// Route to fetch details for a specific inspection (for editing)
app.get('/inspection/:inspection_id', async (req, res) => {
  const inspectionId = req.params.inspection_id; // Fetch inspection ID from URL path
  try {
    const result = await pool.query('SELECT * FROM inspections WHERE id = $1', [inspectionId]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).send('Inspection not found');
    }
  } catch (error) {
    console.error('Error fetching inspection details:', error);
    res.status(500).send('Error fetching inspection details');
  }
});

// Route to handle updating inspection details
app.post('/update-inspection/:inspection_id', async (req, res) => {
  const inspectionId = req.params.inspection_id;
  const { column1, column2, column3 } = req.body; // Replace with actual columns in your form
  
  try {
    const result = await pool.query(
      'UPDATE inspections SET column1 = $1, column2 = $2, column3 = $3 WHERE id = $4',
      [column1, column2, column3, inspectionId]
    );
    if (result.rowCount > 0) {
      res.status(200).send('Inspection updated successfully');
    } else {
      res.status(404).send('Inspection not found');
    }
  } catch (error) {
    console.error('Error updating inspection:', error);
    res.status(500).send('Error updating inspection');
  }
});

// Route to serve inspections.html (display inspections list and form)
app.get('/inspections', (req, res) => {
  if (req.session.user) {
    console.log('Session User:', req.session.user); // Check if session user is set
    res.sendFile(path.join(__dirname, 'public', 'inspections.html'));
  } else {
    console.log('No session user found');
    res.redirect('/'); // Redirect to login if not logged in
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
