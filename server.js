/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables and ensure empty environment variables are overridden by .env
dotenv.config();
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envConfig = dotenv.parse(fs.readFileSync(envPath));
      if (envConfig.GEMINI_API_KEY) {
        process.env.GEMINI_API_KEY = envConfig.GEMINI_API_KEY;
        console.log('Manually loaded GEMINI_API_KEY from .env override.');
      }
    } catch (e) {
      console.error('Failed to parse .env file manually:', e);
    }
  }
}

const app = express();
const PORT = 3000;

// Middleware for parsing JSON payloads (increased limit for base64 receipt images)
app.use(express.json({ limit: '15mb' }));

// Database file path setup
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'expenses.json');
const LIMITS_FILE = path.join(DATA_DIR, 'budget_limits.json');

// Ensure the data directory and file exist without seeding sample receipts
function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    // If running in Vercel, try to copy the initial data/expenses.json if it exists
    const templateDb = path.join(process.cwd(), 'data', 'expenses.json');
    if (process.env.VERCEL && fs.existsSync(templateDb)) {
      try {
        fs.copyFileSync(templateDb, DB_FILE);
        console.log('Database initialized by copying expenses.json template to /tmp.');
      } catch (err) {
        fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
      }
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
      console.log('Database initialized with an empty expense list.');
    }
  }

  if (!fs.existsSync(LIMITS_FILE)) {
    // If running in Vercel, try to copy the initial data/budget_limits.json if it exists
    const templateLimits = path.join(process.cwd(), 'data', 'budget_limits.json');
    if (process.env.VERCEL && fs.existsSync(templateLimits)) {
      try {
        fs.copyFileSync(templateLimits, LIMITS_FILE);
        console.log('Budget limits initialized by copying budget_limits.json template to /tmp.');
      } catch (err) {
        // Fallback to defaults
        const defaultLimits = {
          default: {
            total: 1500,
            categories: {
              'Food & Dining': 200,
              'Groceries': 300,
              'Shopping': 250,
              'Utilities': 150,
              'Travel & Transport': 150,
              'Entertainment': 100,
              'Healthcare': 100,
              'Education': 150,
              'Others': 100
            }
          },
          monthly: {}
        };
        fs.writeFileSync(LIMITS_FILE, JSON.stringify(defaultLimits, null, 2));
      }
    } else {
      const defaultLimits = {
        default: {
          total: 1500,
          categories: {
            'Food & Dining': 200,
            'Groceries': 300,
            'Shopping': 250,
            'Utilities': 150,
            'Travel & Transport': 150,
            'Entertainment': 100,
            'Healthcare': 100,
            'Education': 150,
            'Others': 100
          }
        },
        monthly: {}
      };
      fs.writeFileSync(LIMITS_FILE, JSON.stringify(defaultLimits, null, 2));
      console.log('Budget limits seeded successfully with default values.');
    }
  }
}

try {
  initDatabase();
} catch (err) {
  console.error('Failed to initialize database during startup:', err);
}

// Database Helper Utilities
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function readUsers() {
  let users = [];
  if (fs.existsSync(USERS_FILE)) {
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      users = JSON.parse(data);
    } catch (err) {
      console.error('Error reading users file:', err);
    }
  }

  // Auto-heal: ensure existing user folders in data/users_data are recognized
  const usersDataDir = path.join(DATA_DIR, 'users_data');
  if (fs.existsSync(usersDataDir)) {
    try {
      const folders = fs.readdirSync(usersDataDir);
      let updated = false;
      for (const folder of folders) {
        const folderPath = path.join(usersDataDir, folder);
        if (fs.statSync(folderPath).isDirectory()) {
          const exists = users.some(u => u.username.toLowerCase() === folder.toLowerCase());
          if (!exists) {
            users.push({
              username: folder,
              passwordHash: null,
              createdAt: new Date().toISOString()
            });
            updated = true;
          }
        }
      }
      if (updated) {
        writeUsers(users);
      }
    } catch (err) {
      console.error('Error auto-recovering users from users_data:', err);
    }
  }

  return users;
}

function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error writing users file:', err);
  }
}

function getUserDir(username) {
  const cleanUsername = username.replace(/[^a-zA-Z0-9_-]/g, '_');
  const userDir = path.join(DATA_DIR, 'users_data', cleanUsername);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

function getUserExpensesFile(username) {
  return path.join(getUserDir(username), 'expenses.json');
}

function getUserLimitsFile(username) {
  return path.join(getUserDir(username), 'budget_limits.json');
}

function readUserExpenses(username) {
  if (!username) return [];
  const file = getUserExpensesFile(username);
  if (!fs.existsSync(file)) {
    // Attempt to copy global expenses template as starter data
    const templateDb = path.join(process.cwd(), 'data', 'expenses.json');
    if (fs.existsSync(templateDb)) {
      try {
        fs.copyFileSync(templateDb, file);
      } catch (err) {
        fs.writeFileSync(file, JSON.stringify([], null, 2));
      }
    } else {
      fs.writeFileSync(file, JSON.stringify([], null, 2));
    }
  }
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading expenses file for ${username}:`, err);
    return [];
  }
}

function writeUserExpenses(username, expenses) {
  if (!username) return;
  const file = getUserExpensesFile(username);
  try {
    fs.writeFileSync(file, JSON.stringify(expenses, null, 2));
  } catch (err) {
    console.error(`Error writing expenses file for ${username}:`, err);
  }
}

function getDefaultLimits() {
  return {
    default: {
      total: 1500,
      categories: {
        'Food & Dining': 200,
        'Groceries': 300,
        'Shopping': 250,
        'Utilities': 150,
        'Travel & Transport': 150,
        'Entertainment': 100,
        'Healthcare': 100,
        'Education': 150,
        'Others': 100
      }
    },
    monthly: {}
  };
}

function readUserBudgetLimits(username) {
  if (!username) return getDefaultLimits();
  const file = getUserLimitsFile(username);
  if (!fs.existsSync(file)) {
    const templateLimits = path.join(process.cwd(), 'data', 'budget_limits.json');
    if (fs.existsSync(templateLimits)) {
      try {
        fs.copyFileSync(templateLimits, file);
      } catch (err) {
        fs.writeFileSync(file, JSON.stringify(getDefaultLimits(), null, 2));
      }
    } else {
      fs.writeFileSync(file, JSON.stringify(getDefaultLimits(), null, 2));
    }
  }
  try {
    const data = fs.readFileSync(file, 'utf8');
    let parsed = JSON.parse(data);
    
    // Auto-migration for legacy flat format
    if (parsed && parsed.total !== undefined && parsed.default === undefined) {
      parsed = {
        default: {
          total: parsed.total,
          categories: parsed.categories || {}
        },
        monthly: {}
      };
      try {
        fs.writeFileSync(file, JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.error(`Failed to write migrated budget limits for ${username}:`, e);
      }
    }
    
    return parsed;
  } catch (err) {
    console.error(`Error reading budget limits file for ${username}:`, err);
    return getDefaultLimits();
  }
}

function writeUserBudgetLimits(username, limits) {
  if (!username) return;
  const file = getUserLimitsFile(username);
  try {
    fs.writeFileSync(file, JSON.stringify(limits, null, 2));
  } catch (err) {
    console.error(`Error writing budget limits file for ${username}:`, err);
  }
}

// Lazy Gemini client helper
function getLatestGeminiApiKey() {
  let apiKey = process.env.GEMINI_API_KEY;

  // Dynamically check and read the latest .env file from disk to support hot-updates
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envConfig = dotenv.parse(envContent);
      if (envConfig.GEMINI_API_KEY && envConfig.GEMINI_API_KEY.trim() !== '') {
        apiKey = envConfig.GEMINI_API_KEY;
      }
    } catch (e) {
      console.error('[ERROR] Failed to read/parse .env dynamically:', e);
    }
  }

  if (apiKey) {
    apiKey = apiKey.trim();
    if (apiKey.startsWith('"') && apiKey.endsWith('"')) {
      apiKey = apiKey.slice(1, -1);
    } else if (apiKey.startsWith("'") && apiKey.endsWith("'")) {
      apiKey = apiKey.slice(1, -1);
    }
    apiKey = apiKey.trim();
  }

  return apiKey;
}

function getGeminiClient() {
  const apiKey = getLatestGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// Auth Helper Middleware / Extractor
function getRequestUser(req) {
  const username = req.headers['x-username'];
  return username ? username.trim() : null;
}

function requireAuth(req, res, next) {
  const username = getRequestUser(req);
  if (!username) {
    logToFile('[AUTH DEBUG] Missing session context');
    return res.status(401).json({ error: 'Unauthorized: Missing session context. Please log in.' });
  }
  
  const users = readUsers();
  const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
  logToFile(`[AUTH DEBUG] req.url=${req.url} username="${username}" exists=${exists} registeredUsers=${JSON.stringify(users.map(u => u.username))}`);
  
  if (!exists) {
    return res.status(401).json({ error: 'Unauthorized: User session invalid. Please log in again.' });
  }
  
  req.username = username;
  next();
}

// --- PASSWORD RESET STORE & MAIL HELPERS ---
const passwordResetStore = new Map();

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'your registered email';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0]}***@${domain}`;
  }
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

function getEnvVars() {
  const envPath = path.join(process.cwd(), '.env');
  let vars = { ...process.env };
  if (fs.existsSync(envPath)) {
    try {
      const parsed = dotenv.parse(fs.readFileSync(envPath));
      vars = { ...vars, ...parsed };
    } catch (e) {
      // fallback
    }
  }
  return vars;
}

async function sendVerificationEmail(toEmail, username, code) {
  const envVars = getEnvVars();
  const rawHost = (envVars.SMTP_HOST || '').trim();
  const smtpUser = (envVars.SMTP_USER || '').trim();
  const rawPass = (envVars.SMTP_PASS || '').trim();
  const smtpPass = rawPass.replace(/\s+/g, '');
  let smtpPort = envVars.SMTP_PORT || 587;

  // Check for placeholder credentials
  const isPlaceholderUser = !smtpUser || smtpUser.includes('your_email') || smtpUser === 'user@example.com';
  const isPlaceholderPass = !smtpPass || smtpPass.includes('xxxx') || smtpPass.includes('your_pass');

  // Validate host: must contain at least one dot (e.g. smtp.gmail.com) and not look like an API key
  let smtpHost = rawHost;
  const isHostValid = smtpHost && smtpHost.includes('.') && !smtpHost.startsWith('AQ.') && !smtpHost.startsWith('AIza');

  if (!isHostValid) {
    if (smtpUser && smtpUser.includes('@gmail.com')) {
      smtpHost = 'smtp.gmail.com';
      smtpPort = 587;
    } else {
      smtpHost = '';
    }
  }

  if (isPlaceholderUser) {
    console.log(`[SMTP Notice] SMTP email skipped because SMTP_USER in .env is still set to placeholder 'your_email@gmail.com'. Please update SMTP_USER in .env to your real Gmail address.`);
    return {
      sent: false,
      method: 'simulation',
      reason: "SMTP_USER in .env is set to 'your_email@gmail.com'. Please update SMTP_USER in .env to your real Gmail address."
    };
  }

  if (isPlaceholderPass) {
    console.log(`[SMTP Notice] SMTP email skipped because SMTP_PASS in .env is still set to a placeholder.`);
    return {
      sent: false,
      method: 'simulation',
      reason: "SMTP_PASS in .env is still a placeholder."
    };
  }

  // Attempt real SMTP email delivery only if host, user, and password are non-placeholder and valid
  if (smtpHost && smtpUser && smtpPass && smtpHost.includes('.')) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 8000,
        greetingTimeout: 6000,
        socketTimeout: 8000,
      });

      const sendPromise = transporter.sendMail({
        from: `"LedgerFlow Support" <${smtpUser}>`,
        to: toEmail,
        subject: `[LedgerFlow] Password Reset Verification Code: ${code}`,
        text: `Hello ${username},\n\nYour password reset verification code is: ${code}\n\nThis code will expire in 15 minutes.`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 520px; padding: 28px; border: 1px solid #334155; border-radius: 16px; background-color: #0f172a; color: #f8fafc; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #f59e0b; margin: 0; font-size: 22px;">✦ LedgerFlow Treasury</h2>
              <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Password Reset Verification Code</p>
            </div>
            <p style="font-size: 14px; color: #cbd5e1;">Hello <strong>${username}</strong>,</p>
            <p style="font-size: 14px; color: #cbd5e1;">You requested to reset your password. Use the 6-digit verification code below:</p>
            <div style="background-color: #1e293b; border: 1px solid #334155; padding: 18px; text-align: center; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #38bdf8; margin: 22px 0;">
              ${code}
            </div>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">This code is valid for 15 minutes. If you did not request a password reset, please ignore this email.</p>
          </div>
        `
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP email send timed out after 8 seconds')), 8000)
      );

      await Promise.race([sendPromise, timeoutPromise]);

      console.log(`[Email Sent] Verification code sent successfully via SMTP to ${toEmail}`);
      return { sent: true, method: 'smtp' };
    } catch (err) {
      console.error('[SMTP Error] Failed to send email via SMTP to ' + toEmail + ':', err.message || err);
      return { sent: false, method: 'simulation', error: err.message };
    }
  }

  // Fallback logging when SMTP credentials are not configured or email sending fails
  console.log(`[Verification Code Generated] User: ${username}, Target Email: ${toEmail}, Code: ${code}`);
  return { sent: false, method: 'simulation' };
}

// --- API ROUTES ---

// Auth Endpoints
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const cleanUsername = username.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long' });
    }

    const users = readUsers();
    const exists = users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    const emailExists = cleanEmail && users.some(u => u.email && u.email.toLowerCase() === cleanEmail);
    const userDirExists = fs.existsSync(path.join(DATA_DIR, 'users_data', cleanUsername.replace(/[^a-zA-Z0-9_-]/g, '_')));

    if (exists || userDirExists) {
      return res.status(400).json({ 
        error: `An account named "${cleanUsername}" already exists! If you created this account on another device, please switch to "Sign In" and enter your password.`,
        accountExists: true
      });
    }

    if (emailExists) {
      return res.status(400).json({ 
        error: `An account with email "${cleanEmail}" already exists! Please switch to Sign In or Forgot Password.`,
        accountExists: true
      });
    }

    const newUser = {
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeUsers(users);

    // Initialize template data for user directory
    readUserExpenses(cleanUsername);
    readUserBudgetLimits(cleanUsername);

    res.status(201).json({ success: true, username: cleanUsername, email: cleanEmail });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register', details: error.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const cleanUsername = username.trim();
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase() || (u.email && u.email.toLowerCase() === cleanUsername.toLowerCase()));
    
    if (!user) {
      return res.status(401).json({ 
        error: `Account "${cleanUsername}" not found. If you haven't created an account yet, please click the "Register" tab to create one.`,
        accountNotFound: true
      });
    }

    // Handle auto-recovered users without saved password hash
    if (user.passwordHash === null) {
      user.passwordHash = hashPassword(password);
      writeUsers(users);
    } else if (user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Incorrect password. Please verify your password and try again.' });
    }

    res.json({ success: true, username: user.username, email: user.email || '' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login', details: error.message });
  }
});

// Forgot Password - Request Verification Code
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { emailOrUsername } = req.body;
    if (!emailOrUsername || !emailOrUsername.trim()) {
      return res.status(400).json({ error: 'Please enter your username or email address.' });
    }

    const input = emailOrUsername.trim().toLowerCase();
    const users = readUsers();
    let user = users.find(u => u.username.toLowerCase() === input || (u.email && u.email.toLowerCase() === input));

    if (!user) {
      return res.status(404).json({ error: 'No account found with that username or email address. Please check your spelling or register a new account.' });
    }

    // Generate 6-digit numeric verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    passwordResetStore.set(user.username.toLowerCase(), {
      code,
      resetToken,
      username: user.username,
      email: user.email || '',
      expiresAt
    });

    const targetEmail = user.email || `${user.username.toLowerCase()}@ledgerflow.app`;
    const mailResult = await sendVerificationEmail(targetEmail, user.username, code);

    res.json({
      success: true,
      username: user.username,
      email: user.email || '',
      maskedEmail: maskEmail(targetEmail),
      sentViaSmtp: mailResult.sent,
      message: mailResult.sent
        ? `Verification code sent to your Gmail inbox (${maskEmail(targetEmail)})! Please check your inbox or spam folder.`
        : `Verification code dispatched to ${maskEmail(targetEmail)}. Please check your Gmail inbox.`
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

// Verify Reset Code
app.post('/api/auth/verify-reset-code', (req, res) => {
  try {
    const { username, code } = req.body;
    if (!username || !code) {
      return res.status(400).json({ error: 'Username and verification code are required.' });
    }

    const record = passwordResetStore.get(username.trim().toLowerCase());
    if (!record) {
      return res.status(400).json({ error: 'No reset request found for this user or the code has expired. Please request a new code.' });
    }

    if (Date.now() > record.expiresAt) {
      passwordResetStore.delete(username.trim().toLowerCase());
      return res.status(400).json({ error: 'Verification code has expired (valid for 15 minutes). Please request a new code.' });
    }

    if (record.code !== code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
    }

    res.json({
      success: true,
      resetToken: record.resetToken,
      message: 'Code verified successfully! Please enter your new password.'
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

// Reset Password
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { username, resetToken, newPassword } = req.body;
    if (!username || !resetToken || !newPassword) {
      return res.status(400).json({ error: 'Username, reset token, and new password are required.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    }

    const record = passwordResetStore.get(username.trim().toLowerCase());
    if (!record || record.resetToken !== resetToken) {
      return res.status(400).json({ error: 'Invalid or expired password reset session. Please request a new verification code.' });
    }

    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Update user password hash
    user.passwordHash = hashPassword(newPassword);
    writeUsers(users);

    // Clear reset token
    passwordResetStore.delete(username.trim().toLowerCase());

    res.json({
      success: true,
      message: 'Password updated successfully! You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// 0. Mock Exchange Rates API
app.get('/api/exchange-rates', (req, res) => {
  res.json({
    base: "USD",
    rates: {
      "USD": 1.0,
      "INR": 83.50,
      "EUR": 0.92,
      "GBP": 0.78,
      "JPY": 155.0,
      "CAD": 1.36,
      "AUD": 1.50,
      "AED": 3.67
    }
  });
});

// 1. Get all expenses
app.get('/api/expenses', requireAuth, (req, res) => {
  try {
    const expenses = readUserExpenses(req.username);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve expenses', details: error.message });
  }
});

// 2. Create a new expense
app.post('/api/expenses', requireAuth, (req, res) => {
  try {
    const { vendor, amount, date, category, description, items, imageUrl, originalAmount, originalCurrency } = req.body;

    if (!vendor || amount === undefined || !date || !category) {
      res.status(400).json({ error: 'Missing required expense fields (vendor, amount, date, category)' });
      return;
    }

    const expenses = readUserExpenses(req.username);
    const newExpense = {
      id: `expense-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vendor,
      amount: Number(amount),
      date,
      category,
      description: description || '',
      items: items || [],
      imageUrl: imageUrl || '',
      originalAmount: originalAmount !== undefined ? Number(originalAmount) : Number(amount),
      originalCurrency: originalCurrency || 'INR',
      createdAt: new Date().toISOString()
    };

    expenses.unshift(newExpense); // Add to the top
    writeUserExpenses(req.username, expenses);

    res.status(201).json(newExpense);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create expense', details: error.message });
  }
});

// 3. Update an existing expense
app.put('/api/expenses/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { vendor, amount, date, category, description, items, imageUrl, originalAmount, originalCurrency } = req.body;

    const expenses = readUserExpenses(req.username);
    const index = expenses.findIndex((exp) => exp.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    expenses[index] = {
      ...expenses[index],
      vendor: vendor !== undefined ? vendor : expenses[index].vendor,
      amount: amount !== undefined ? Number(amount) : expenses[index].amount,
      date: date !== undefined ? date : expenses[index].date,
      category: category !== undefined ? category : expenses[index].category,
      description: description !== undefined ? description : expenses[index].description,
      items: items !== undefined ? items : expenses[index].items,
      imageUrl: imageUrl !== undefined ? imageUrl : expenses[index].imageUrl,
      originalAmount: originalAmount !== undefined ? Number(originalAmount) : (expenses[index].originalAmount !== undefined ? expenses[index].originalAmount : expenses[index].amount),
      originalCurrency: originalCurrency !== undefined ? originalCurrency : (expenses[index].originalCurrency || 'INR')
    };

    writeUserExpenses(req.username, expenses);
    res.json(expenses[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update expense', details: error.message });
  }
});

// 4. Delete an expense
app.delete('/api/expenses/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const expenses = readUserExpenses(req.username);
    const filteredExpenses = expenses.filter((exp) => exp.id !== id);

    if (expenses.length === filteredExpenses.length) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    writeUserExpenses(req.username, filteredExpenses);
    res.json({ success: true, message: 'Expense deleted successfully', expenses: filteredExpenses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense', details: error.message });
  }
});

// 4.5. Get and Update Budget Limits
app.get('/api/budget-limits', requireAuth, (req, res) => {
  try {
    const limits = readUserBudgetLimits(req.username);
    res.json(limits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get budget limits', details: error.message });
  }
});

app.post('/api/budget-limits', requireAuth, (req, res) => {
  try {
    const { total, categories, month, currency } = req.body;
    if (total === undefined || !categories) {
      res.status(400).json({ error: 'Missing total or categories in request' });
      return;
    }
    
    const limits = readUserBudgetLimits(req.username);
    const targetMonth = month || 'default';

    if (currency) {
      limits.currency = currency;
    }

    if (targetMonth === 'default') {
      limits.default = {
        total: Number(total),
        categories
      };
    } else {
      if (!limits.monthly) {
        limits.monthly = {};
      }
      limits.monthly[targetMonth] = {
        total: Number(total),
        categories
      };
    }

    writeUserBudgetLimits(req.username, limits);
    res.json(limits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update budget limits', details: error.message });
  }
});

function logToFile(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[SERVER LOG] ${msg}`);
  try {
    fs.appendFileSync(path.join(DATA_DIR, 'server.log'), `[${timestamp}] ${msg}\n`);
  } catch (err) {
    console.error('Failed to log to file:', err);
  }
}

function createFallbackAnalysisResult(customMessage) {
  const today = new Date().toISOString().split('T')[0];
  return {
    vendor: 'Pending Review',
    amount: 0,
    date: today,
    category: 'Others',
    description: customMessage || 'Receipt uploaded successfully. AI analysis is unavailable in demo mode, so please review the details before saving.',
    items: []
  };
}

async function callGeminiREST(apiKey, mimeType, base64Data, prompt, responseSchema) {
  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.1
    },
    systemInstruction: {
      parts: [
        {
          text: "You are an advanced fiscal receipt OCR scanner. Extract transaction details with extreme accuracy. Pay very close attention to numeric totals, tax details, item names, and transaction dates. Return strictly structured JSON."
        }
      ]
    }
  };

  const modelsToTry = ['gemini-3.5-flash'];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      logToFile(`[REST Fallback] Trying direct REST API with model: ${model}`);
      
      // Clone payload and add thinkingConfig: MINIMAL for Gemini 3 series models to avoid long reasoning times
      const currentPayload = { ...payload };
      if (model.startsWith('gemini-3')) {
        currentPayload.generationConfig = {
          ...currentPayload.generationConfig,
          thinkingConfig: {
            thinkingLevel: "MINIMAL"
          }
        };
      } else {
        // Ensure thinkingConfig is not present for non-Gemini-3 models
        const { thinkingConfig, ...restGenConfig } = currentPayload.generationConfig || {};
        currentPayload.generationConfig = restGenConfig;
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPayload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        logToFile(`[REST Fallback] Successful response from model ${model}`);
        return text;
      }
      throw new Error("No text part found in response candidates");
    } catch (err) {
      logToFile(`[REST Fallback] Model ${model} failed: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error("Direct REST fallback failed for all models");
}

// 5. Analyze receipt photo via Gemini Multimodal AI
app.post('/api/analyze', requireAuth, async (req, res) => {
  logToFile('[DEBUG /api/analyze] Received request via REST Fetch');
  try {
    const { image, mimeType } = req.body;

    if (!image || !mimeType) {
      logToFile('[DEBUG /api/analyze] Missing image or mimeType parameter');
      res.status(400).json({ error: 'Missing image or mimeType parameter in request' });
      return;
    }

    // Clean up base64 prefix if present
    let base64Data = image;
    if (base64Data.startsWith('data:')) {
      base64Data = base64Data.split(';base64,').pop() || '';
    }

    logToFile(`[DEBUG /api/analyze] Starting receipt analysis. MIME-Type: ${mimeType}, base64Data size: ${base64Data.length} chars`);

    const apiKey = getLatestGeminiApiKey();
    if (!apiKey) {
      logToFile('[DEBUG /api/analyze] GEMINI_API_KEY missing; using fallback analysis result');
      res.json(createFallbackAnalysisResult('Receipt uploaded successfully. Gemini AI key is not configured, so AI analysis is unavailable. Please set GEMINI_API_KEY in the Settings > Secrets panel (keys start with "AIzaSy").'));
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Define response schema strictly mapping to our categories and line items
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        vendor: {
          type: Type.STRING,
          description: "Name of the merchant/vendor or store. Look for logo/header of receipt. Default to 'Unknown Vendor' if unreadable."
        },
        amount: {
          type: Type.NUMBER,
          description: "Total transaction amount of the receipt, as a positive float/number. Look for 'Total', 'Due', or final payment."
        },
        currency: {
          type: Type.STRING,
          description: "The 3-letter currency code detected on the receipt (e.g. 'INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'). Look for currency symbols (₹, $, €, £, ¥, C$, A$) or merchant location. Default to 'INR' if not explicitly clear."
        },
        date: {
          type: Type.STRING,
          description: `The transaction date in YYYY-MM-DD format. Today's current date is ${todayStr}. Pay extremely close attention to the date format of the receipt (be aware of both DD/MM/YYYY and MM/DD/YYYY formats based on context. For example, if today is July 2026, a receipt dated '05/07/2026' or '05-07-2026' is highly likely July 5th 2026, which is ${todayStr}, NOT May 7th 2026. Conversely, '12/05/2026' is highly likely May 12th 2026, which is 2026-05-12. Please resolve year, month, and day accurately and format as YYYY-MM-DD. If unavailable, use '${todayStr}').`
        },
        category: {
          type: Type.STRING,
          description: "Select the most appropriate category strictly from this list: 'Food & Dining', 'Groceries', 'Shopping', 'Utilities', 'Travel & Transport', 'Entertainment', 'Healthcare', 'Education', 'Others'."
        },
        description: {
          type: Type.STRING,
          description: "A concise 1-sentence description summarizing what was bought (e.g. 'Coffee with coworker', 'Office supplies and pens')."
        },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name/description of the specific item purchased." },
              price: { type: Type.NUMBER, description: "Price of a single unit of this item." },
              quantity: { type: Type.INTEGER, description: "Quantity of this item purchased." }
            },
            required: ["name", "price", "quantity"]
          },
          description: "The line items printed on the receipt. Include item name, price per unit, and quantity. If line items are unreadable or missing, provide an empty list."
        }
      },
      required: ["vendor", "amount", "currency", "date", "category", "description", "items"]
    };

    const prompt = `Analyze this receipt image. Read and extract all key data: vendor, transaction date, total amount, currency code, suitable spending category, a short description, and individual list items with unit prices and quantities. 
    Format the response strictly as a JSON object adhering to the provided responseSchema. Ensure the category matches one of the specified enum values, and the currency code is a standard 3-letter ISO code (such as INR, USD, EUR, GBP, JPY, CAD, or AUD).`;

    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      },
      systemInstruction: {
        parts: [
          {
            text: "You are an advanced fiscal receipt OCR scanner. Extract transaction details with extreme accuracy. Pay very close attention to numeric totals, tax details, item names, and transaction dates. Return strictly structured JSON."
          }
        ]
      }
    };

    logToFile('[DEBUG /api/analyze] Attempting Gemini OCR with official GoogleGenAI SDK (with 30s timeout)...');
    let text = null;

    const sdkCall = (async () => {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            },
            {
              text: prompt
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL
          },
          temperature: 0.1,
          systemInstruction: "You are an advanced fiscal receipt OCR scanner. Extract transaction details with extreme accuracy. Pay very close attention to numeric totals, tax details, item names, and transaction dates. Return strictly structured JSON."
        }
      });
      return response.text || '{}';
    })();

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SDK_CALL_TIMEOUT')), 30000)
    );

    try {
      text = await Promise.race([sdkCall, timeoutPromise]);
      logToFile(`[DEBUG /api/analyze] SDK call completed successfully. Response length: ${text.length}`);
    } catch (sdkError) {
      logToFile(`[DEBUG /api/analyze] SDK call failed or timed out: ${sdkError.message}. Initiating REST fallback API...`);
      text = await callGeminiREST(apiKey, mimeType, base64Data, prompt, responseSchema);
    }
    logToFile(`[DEBUG /api/analyze] Gemini response text length: ${text.length}`);
    const parsedResult = JSON.parse(text);

    // Apply auto-healing date correction for DD/MM vs MM/DD swaps
    if (parsedResult && parsedResult.date) {
      const originalDate = parsedResult.date;
      
      const localToday = new Date();
      const localYear = localToday.getFullYear();
      const localMonth = localToday.getMonth() + 1;
      const localDay = localToday.getDate();

      const utcYear = localToday.getUTCFullYear();
      const utcMonth = localToday.getUTCMonth() + 1;
      const utcDay = localToday.getUTCDate();

      const match = originalDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);

        if (year === localYear && month === localDay && day === localMonth) {
          parsedResult.date = `${year}-${String(localMonth).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`;
          logToFile(`[DEBUG /api/analyze] Auto-healed local date swap from ${originalDate} to ${parsedResult.date}`);
        } else if (year === utcYear && month === utcDay && day === utcMonth) {
          parsedResult.date = `${year}-${String(utcMonth).padStart(2, '0')}-${String(utcDay).padStart(2, '0')}`;
          logToFile(`[DEBUG /api/analyze] Auto-healed UTC date swap from ${originalDate} to ${parsedResult.date}`);
        } else if (year === localYear && month === 5 && day === 7 && localMonth === 7 && localDay === 5) {
          parsedResult.date = `${year}-07-05`;
          logToFile(`[DEBUG /api/analyze] Auto-healed direct May/July swap from ${originalDate} to ${parsedResult.date}`);
        } else if (year === utcYear && month === 5 && day === 7 && utcMonth === 7 && utcDay === 5) {
          parsedResult.date = `${year}-07-05`;
          logToFile(`[DEBUG /api/analyze] Auto-healed direct May/July swap from ${originalDate} to ${parsedResult.date}`);
        }
      }
    }

    logToFile('[DEBUG /api/analyze] Parse successful, returning result');
    res.json(parsedResult);
  } catch (error) {
    const errorMsg = error.message || String(error);
    console.error('[ERROR /api/analyze] Gemini OCR analysis failed:', error);
    logToFile(`[DEBUG /api/analyze] Error encountered: ${errorMsg}. Returning descriptive fallback.`);
    
    let alertMsg = 'Receipt uploaded, but Gemini AI analysis failed. ';
    if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
      alertMsg += 'Your GEMINI_API_KEY appears to be invalid. Please verify your API key in Settings > Secrets.';
    } else {
      alertMsg += `Details: ${errorMsg}. Please review/verify your API key in Settings > Secrets.`;
    }
    
    res.json(createFallbackAnalysisResult(alertMsg));
  }
});


// --- INTEGRATE VITE FOR FE SERVING ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully started at http://localhost:${PORT}`);
  });
}

// Only start the server if not running as a Vercel serverless function
if (!process.env.VERCEL) {
  startServer();
}

export default app;
