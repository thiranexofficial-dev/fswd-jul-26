# Thiranex Internship Registration System

This project is a premium, responsive, serverless registration portal for the Thiranex Full Stack Web Development internship. It is built using HTML5, CSS3 (glassmorphism/dark mode), and Vanilla JavaScript. 

It has been modernized to use **Firebase** as its backend database and authentication system, entirely replacing the old Google Apps Script architecture.

---

## 📂 Project Structure

### Portals
- `index.html` — The public-facing registration form for students.
- `admin.html` — The master dashboard for operations (Approve/Reject/Settings/Team Access).
- `telecaller.html` — A read-only dashboard for telecallers to view leads and track daily counts.

### Scripts
- `firebase-config.js` — Holds your secure Firebase connection keys.
- `app.js` — Client-side logic for the public registration form (writes to Firestore).
- `admin.js` — Logic for the Admin portal (reads/writes to Firestore, creates users, sends EmailJS emails).
- `telecaller.js` — Logic for the Telecaller portal (reads from Firestore).
- `style.css` & `admin.css` — High-fidelity stylesheets.

---

## 🚀 Step 1: Firebase Configuration (Already Done!)

Your system is already connected to Firebase! If you ever need to change your database in the future, follow these steps:

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click the **Gear icon (Settings)** next to Project Overview -> **Project settings**.
3. Scroll down to **Your apps**, click the **Web (</>)** icon, and register an app.
4. Copy the `firebaseConfig` object and paste it into your `firebase-config.js` file.

---

## 🔐 Step 2: Unlocking Your First Admin Account

The dashboard uses **Role-Based Access Control (RBAC)**. You cannot log into `admin.html` until you create a Master Admin account in the database. 

You only have to do this **ONCE**!

### A. Create the User
1. Go to your Firebase Console.
2. Click **Build > Authentication** on the left menu.
3. Click the **Add user** button.
4. Enter your admin email (e.g., `admin@thiranex.com`) and a secure password. Click **Add user**.
5. Find the newly created user in the table and **copy their UID** (a long string of random characters).

### B. Assign the Admin Role
1. On the left menu, click **Build > Firestore Database**.
2. Click **Start collection**.
3. For Collection ID, type exactly: `users`. Click Next.
4. For Document ID, **Paste the UID** you just copied from Authentication.
5. Add a field:
   - Field: `role`
   - Type: `string`
   - Value: `admin`
6. Click **Save**.

*You can now open `admin.html` and log in with your email and password!*

---

## 👥 Step 3: Creating Telecaller Accounts

You never have to touch the Firebase Console to make accounts again.

1. Log into your **Admin Dashboard** (`admin.html`).
2. Click on the **Team Access** tab on the left sidebar.
3. Type in the email and a temporary password for your telecaller.
4. Set the Role dropdown to **Telecaller (Read-Only)**.
5. Click **Create Account**.

The telecaller can now go to `telecaller.html` and log in with those credentials! *(If they try to log into the Admin portal, the system will block them).*

---

## 📧 Step 4: Activating Automated Emails (Optional)

When you click "Verify & Approve" or "Reject" in the Admin Dashboard, the system can automatically send an email to the student. This is powered by **EmailJS**.

1. Create a free account at [EmailJS.com](https://www.emailjs.com/).
2. Go to **Email Services**, click "Add New Service", select Gmail, and connect your Thiranex Gmail account. Note down your `Service ID`.
3. Go to **Email Templates**, create a template with `{{message}}` in the body, and note down your `Template ID`.
4. Go to **Account > API Keys** to find your `Public Key`.
5. Open your `admin.js` file in a code editor.
6. Around line 250, you will see placeholders for `YOUR_EMAILJS_SERVICE_ID`, `YOUR_EMAILJS_TEMPLATE_ID`, and `YOUR_EMAILJS_PUBLIC_KEY`. Paste your keys there!

*(Note: Even without EmailJS, you can use the **WhatsApp** buttons in the dashboard to instantly text students!)*
