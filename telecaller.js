/**
 * Thiranex Telecaller Dashboard SPA Controller
 * Powered by Firebase
 */

let cachedData = []; // Store registrations
let currentUserEmail = ''; // Store the logged-in telecaller's email
let currentUserName = ''; // Store the logged-in telecaller's proper name

// DOM Elements
const btnLogin = document.getElementById('btn-login');
const emailInput = document.getElementById('telecaller-email');
const passwordInput = document.getElementById('telecaller-password');
const loginPanel = document.getElementById('login-panel');
const dashboardPanel = document.getElementById('dashboard-panel');
const btnRefresh = document.getElementById('btn-refresh');
const btnLogout = document.getElementById('btn-logout');

// Search & Filter
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');

// Metrics
const mTotal = document.getElementById('metric-total');
const mUploaded = document.getElementById('metric-hot'); // Hot Leads Metric
const mPending = document.getElementById('metric-pending');
const mSales = document.getElementById('metric-sales');

const tLeads = document.getElementById('table-leads');

// Loader
const loadingOverlay = document.getElementById('telecaller-loading');
const loadingText = document.getElementById('telecaller-loading-text');

const btnCopyLink = document.getElementById('btn-copy-link');

function showLoader(message) {
  loadingText.innerText = message;
  loadingOverlay.classList.add('active');
}

function hideLoader() {
  loadingOverlay.classList.remove('active');
}

// ==========================================
// 1. AUTHENTICATION (Firebase)
// ==========================================

// Handle persistent login state
auth.onAuthStateChanged((user) => {
  if (user) {
    showLoader("Restoring session...");
    db.collection('users').doc(user.uid).get()
      .then((doc) => {
        if (doc.exists && (doc.data().role === 'telecaller' || doc.data().role === 'admin')) {
          currentUserEmail = user.email;
          
          // Get the name from DB, or fallback to parsing the email
          if (doc.data().name) {
            currentUserName = doc.data().name;
          } else {
            const rawName = currentUserEmail.split('@')[0].replace(/[^a-zA-Z]/g, ' ');
            currentUserName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          }
          
          const nameDisplay = document.getElementById('telecaller-name-display');
          if (nameDisplay) nameDisplay.innerText = currentUserName;

          hideLoader();
          loginPanel.style.display = 'none';
          dashboardPanel.style.display = 'flex';
          fetchRegistrations();
        } else {
          auth.signOut();
          if (!doc.exists) {
            alert("Diagnostic: Kicked out because the 'users' document for this account does not exist in the database. UID: " + user.uid);
          } else {
            alert("Diagnostic: Kicked out because the role is set to '" + doc.data().role + "' instead of 'telecaller'.");
          }
        }
      }).catch((error) => {
        hideLoader();
        alert("Diagnostic: Database read error during login: " + error.message);
      });
  } else {
    loginPanel.style.display = 'block';
    dashboardPanel.style.display = 'none';
  }
});

if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    auth.signOut().then(() => {
      loginPanel.style.display = 'block';
      dashboardPanel.style.display = 'none';
    });
  });
}

btnLogin.addEventListener('click', () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }
  
  showLoader("Authenticating...");
  
  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      // Check RBAC Role
      return db.collection('users').doc(userCredential.user.uid).get()
        .then((doc) => {
          if (doc.exists && (doc.data().role === 'telecaller' || doc.data().role === 'admin')) {
            currentUserEmail = email; // Save for filtering
            
            if (doc.data().name) {
              currentUserName = doc.data().name;
            } else {
              const rawName = currentUserEmail.split('@')[0].replace(/[^a-zA-Z]/g, ' ');
              currentUserName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            }
            
            const nameDisplay = document.getElementById('telecaller-name-display');
            if (nameDisplay) nameDisplay.innerText = currentUserName;

            hideLoader();
            loginPanel.style.display = 'none';
            dashboardPanel.style.display = 'flex';
            fetchRegistrations();
          } else {
            auth.signOut();
            throw new Error("Access Denied: You do not have permission to view the Telecaller portal.");
          }
        });
    })
    .catch((error) => {
      hideLoader();
      alert("Login Failed: " + error.message);
    });
});

const btnForgotPassword = document.getElementById('btn-forgot-password');
const resetModal = document.getElementById('forgot-password-modal');
const btnCancelReset = document.getElementById('btn-cancel-reset');
const btnSubmitReset = document.getElementById('btn-submit-reset');
const resetEmailInput = document.getElementById('reset-email-input');

if (btnForgotPassword && resetModal) {
  // Open Modal
  btnForgotPassword.addEventListener('click', (e) => {
    e.preventDefault();
    resetEmailInput.value = emailInput.value; // Pre-fill if they already typed it
    resetModal.style.display = 'flex';
  });

  // Close Modal
  btnCancelReset.addEventListener('click', () => {
    resetModal.style.display = 'none';
  });

  // Submit Reset
  btnSubmitReset.addEventListener('click', () => {
    const email = resetEmailInput.value.trim();
    if (!email) {
      alert("Please enter your email address.");
      return;
    }
    
    // Hide modal and show loader
    resetModal.style.display = 'none';
    showLoader("Sending reset email...");
    
    auth.sendPasswordResetEmail(email)
      .then(() => {
        hideLoader();
        document.getElementById('reset-success-modal').style.display = 'flex';
      })
      .catch((error) => {
        hideLoader();
        alert("Error sending reset email: " + error.message);
      });
  });
}

// ==========================================
// 2. DATA FETCHING (Firestore)
// ==========================================
let isListening = false;
function fetchRegistrations() {
  if (isListening) return; // Prevent multiple listeners
  showLoader('Syncing Leads...');
  isListening = true;
  
  db.collection('registrations').orderBy('timestamp', 'desc')
    .onSnapshot((querySnapshot) => {
      hideLoader();
      cachedData = [];
      querySnapshot.forEach((doc) => {
        cachedData.push(doc.data());
      });
      processData(cachedData);
    }, (error) => {
      hideLoader();
      alert("Error fetching data: " + error.message);
    });
}

function processData(rows) {
  // All leads are available to all telecallers
  const myLeads = rows;
  
  const uploaded = myLeads.filter(r => r.status === 'Uploaded Lead' || r.status === 'Cold Lead' || r.status === 'Hot Lead' || r.status === 'Follow-up Required');
  
  // Pending payments that were referred by this telecaller
  const pending = rows.filter(r => r.status === 'Pending Verification' && r.referredBy === currentUserEmail);
  
  // A "Sale" is an Approved registration that was explicitly referred by this telecaller
  const sales = rows.filter(r => r.status === 'Approved' && r.referredBy === currentUserEmail);
  
  // Update Metrics
  if(mUploaded) mUploaded.innerText = uploaded.length;
  if(mPending) mPending.innerText = pending.length;
  if(mSales) mSales.innerText = sales.length;
  
  const followups = myLeads.filter(r => r.status === 'Follow-up Required');
  const badgeFollowups = document.getElementById('badge-followups');
  if(badgeFollowups) badgeFollowups.innerText = followups.length;
  
  applyFilters(); // Initial render
}

// ==========================================
// 3. SEARCH & FILTER
// ==========================================
let currentTab = 'dashboard';

window.switchTab = function(tab) {
  currentTab = tab;
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + tab).classList.add('active');
  
  if (tab === 'dashboard') {
    document.getElementById('view-title').innerText = 'Leads Queue';
  } else if (tab === 'followups') {
    document.getElementById('view-title').innerText = 'Interested (Follow-ups)';
  } else if (tab === 'rejected') {
    document.getElementById('view-title').innerText = 'Not Interested (Dead Leads)';
  } else if (tab === 'pending') {
    document.getElementById('view-title').innerText = 'Pending Verifications';
  } else if (tab === 'sales') {
    document.getElementById('view-title').innerText = 'My Sales (Approved)';
  }
  
  applyFilters();
};

function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase().trim();

  const filteredData = cachedData.filter(row => {
    // 1. Tab Filter
    if (currentTab === 'dashboard') {
      if (!['Hot Lead', 'Cold Lead', 'Uploaded Lead'].includes(row.status)) return false;
    } else if (currentTab === 'followups') {
      if (row.status !== 'Follow-up Required') return false;
    } else if (currentTab === 'rejected') {
      if (row.status !== 'Rejected') return false;
    } else if (currentTab === 'pending') {
      if (row.status !== 'Pending Verification' || row.referredBy !== currentUserEmail) return false;
    } else if (currentTab === 'sales') {
      if (row.status !== 'Approved' || row.referredBy !== currentUserEmail) return false;
    }
    
    // 2. Search Text
    if (searchTerm) {
      const matchName = (row.fullName || '').toLowerCase().includes(searchTerm);
      const matchEmail = (row.email || '').toLowerCase().includes(searchTerm);
      const matchPhone = (row.phone || '').includes(searchTerm);
      const matchId = (row.registrationId || '').toLowerCase().includes(searchTerm);
      
      return matchName || matchEmail || matchPhone || matchId;
    }
    
    return true;
  });

  renderLeadsTable(filteredData);
}

searchInput.addEventListener('input', applyFilters);

// ==========================================
// 4. RENDER TABLE
// ==========================================
function renderLeadsTable(rows) {
  tLeads.innerHTML = '';
  
  if (rows.length === 0) {
    tLeads.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching leads found.</td></tr>';
    return;
  }

  const now = new Date().getTime();

  rows.forEach(row => {
    const tr = document.createElement('tr');
    
    // Styling row based on status for extreme efficiency
    if (row.status === 'Pending Verification' || row.status === 'Uploaded Lead') {
      tr.style.backgroundColor = 'rgba(245, 158, 11, 0.05)'; // Very faint yellow
    } else if (row.status === 'Approved') {
      tr.style.backgroundColor = 'rgba(16, 185, 129, 0.05)'; // Very faint green
    }

    let followUpHtml = '';
    if (row.followUpDate) {
      const fDate = new Date(row.followUpDate);
      let color = 'var(--text-muted)';
      if (fDate.getTime() < now) {
        color = 'var(--danger)'; // Overdue
      } else if (fDate.toDateString() === new Date().toDateString()) {
        color = 'var(--primary)'; // Today
      }
      
      const timeStr = fDate.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
      followUpHtml = `<div style="margin-top: 0.25rem; font-size: 0.75rem; font-weight: 600; color: ${color};">⏰ ${timeStr}</div>`;
    } else {
      followUpHtml = `<div style="margin-top: 0.25rem; font-size: 0.75rem; color: var(--text-muted);">No follow-up set</div>`;
    }

    let statusDisplay = '';
    if (row.status === 'Approved') {
      statusDisplay = '<span style="color: var(--success); font-weight: bold;">Approved</span>';
    } else if (row.status === 'Pending Verification') {
      statusDisplay = '<span style="color: var(--warning); font-weight: bold;">Pending Payment</span>';
    } else {
      statusDisplay = `
        <select class="form-control" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-bottom: 0.25rem; height: auto;" onchange="window.updateStatusQuick('${row.registrationId}', this.value)">
          <option value="Hot Lead" ${['Hot Lead', 'Uploaded Lead', 'Cold Lead'].includes(row.status) ? 'selected' : ''}>🔥 Lead</option>
          <option value="Follow-up Required" ${row.status === 'Follow-up Required' ? 'selected' : ''}>✅ Interested (Follow-up)</option>
          <option value="Rejected" ${row.status === 'Rejected' ? 'selected' : ''}>🚫 Not Interested</option>
        </select>
      `;
    }
    
    let statusHtml = statusDisplay + followUpHtml;
    
    // Ensure course isn't blank
    const courseName = row.course && row.course !== 'Unknown Course' ? row.course : 'Fullstack Webdevelopment Training CuM Internship program';

    // WhatsApp Formatting for easy reach out
    const waNumber = (row.phone || '').replace(/[^0-9]/g, '');
    let waMessage = encodeURIComponent(`Hello ${row.fullName || 'Student'}, this is ${currentUserName || 'an Admin'} from Thiranex regarding your registration for ${courseName}.`);
    
    // Send Link Formatting
    let shortId = currentUserEmail;
    if (shortId.endsWith('@thiranex.com')) shortId = shortId.split('@')[0];
    const encodedEmail = btoa(shortId).replace(/=/g, '');
    const refLink = `${window.location.origin}/index.html?t=${encodedEmail}`;
    let linkMessage = encodeURIComponent(`Hello ${row.fullName || 'Student'},\n\nYou can complete your registration for ${courseName} using this link:\n${refLink}\n\nLet me know if you have any questions!\n- ${currentUserName || 'Admin'}`);
    
    tr.innerHTML = `
      <td><strong>${row.registrationId || 'N/A'}</strong></td>
      <td>
        <div style="font-weight: 600;">${row.fullName || 'No Name'}</div>
        <div style="font-size: 0.8rem; color: var(--text-dark);">${row.email || 'No Email'}</div>
      </td>
      <td><a href="tel:${row.phone || ''}" style="color: var(--primary); font-weight: 500; text-decoration: none;">${row.phone || 'No Phone'}</a></td>
      <td>${statusHtml}</td>
      <td class="action-buttons">
        <button class="btn-sm btn-whatsapp" onclick="window.open('https://wa.me/91${waNumber}?text=${waMessage}', '_blank')" title="WhatsApp Greeting"></button>
        <button class="btn-sm" style="background: var(--primary); color: white; border: none; display: flex; align-items: center; gap: 4px;" onclick="window.open('https://wa.me/91${waNumber}?text=${linkMessage}', '_blank')" title="Send Referral Link">🔗 Send Link</button>
      </td>
    `;
    tLeads.appendChild(tr);
  });
}

// Refresh Data Listener
btnRefresh.addEventListener('click', fetchRegistrations);

if (btnCopyLink) {
  btnCopyLink.addEventListener('click', () => {
    const url = new URL(window.location.href);
    const indexUrl = url.href.replace('telecaller.html', 'index.html').split('?')[0];
    
    let shortId = currentUserEmail;
    if (shortId.endsWith('@thiranex.com')) shortId = shortId.split('@')[0];
    const encodedEmail = btoa(shortId).replace(/=/g, '');
    
    const referralUrl = `${indexUrl}?t=${encodedEmail}`;
    
    navigator.clipboard.writeText(referralUrl).then(() => {
      alert("Referral Link Copied: " + referralUrl);
    }).catch(err => {
      prompt("Copy your referral link manually:", referralUrl);
    });
  });
}

window.updateStatusQuick = function(regId, newStatus) {
  if (newStatus === 'Rejected') {
    if(!confirm("Are you sure you want to mark this lead as 'Not Interested'? It will be removed from your active queue.")) {
      fetchRegistrations(); // Refresh to reset dropdown state visually
      return;
    }
  }
  
  showLoader("Updating Lead...");
  db.collection('registrations').doc(regId).update({ status: newStatus })
    .then(() => {
      hideLoader();
    })
    .catch((err) => {
      hideLoader();
      alert("Error updating status: " + err.message);
    });
};
