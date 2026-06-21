/**
 * Thiranex Admin Dashboard SPA Controller
 * Powered by Firebase & EmailJS
 */

let cachedData = []; // Store registrations
let currentFeeAmount = 299; // For revenue calculation
let telecallersList = []; // Array of {email, role}

// DOM Elements
const btnLogin = document.getElementById('btn-login');
const emailInput = document.getElementById('admin-email');
const passwordInput = document.getElementById('admin-password');
const loginPanel = document.getElementById('login-panel');
const dashboardPanel = document.getElementById('dashboard-panel');
const btnRefresh = document.getElementById('btn-refresh');
const btnLogout = document.getElementById('btn-logout');

// Navigation
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.dashboard-view');

// Metrics & Badges
const mTotal = document.getElementById('metric-total');
const mPending = document.getElementById('metric-pending');
const mApproved = document.getElementById('metric-approved');
const mRevenue = document.getElementById('metric-revenue');
const bPending = document.getElementById('badge-pending');
const bApproved = document.getElementById('badge-approved');
const bLeads = document.getElementById('badge-leads');

// Tables
const tPending = document.getElementById('table-pending');
const tApproved = document.getElementById('table-approved');
const tLeads = document.getElementById('table-leads');

// Settings Elements
const inputUpi = document.getElementById('setting-upi');
const inputAmount = document.getElementById('setting-amount');
const btnSaveSettings = document.getElementById('btn-save-settings');

// Loader
const loadingOverlay = document.getElementById('admin-loading');
const loadingText = document.getElementById('admin-loading-text');

// ==========================================
// 1. SPA ROUTING
// ==========================================
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    views.forEach(v => v.classList.remove('active'));
    const targetId = link.getAttribute('data-target');
    document.getElementById(targetId).classList.add('active');
  });
});

function showLoader(message) {
  loadingText.innerText = message;
  loadingOverlay.classList.add('active');
}

function hideLoader() {
  loadingOverlay.classList.remove('active');
}

// ==========================================
// 2. AUTHENTICATION (Firebase)
// ==========================================

// Handle persistent login state
auth.onAuthStateChanged((user) => {
  if (user) {
    showLoader("Restoring session...");
    db.collection('users').doc(user.uid).get()
      .then((doc) => {
        if (doc.exists && doc.data().role === 'admin') {
          hideLoader();
          loginPanel.style.display = 'none';
          dashboardPanel.style.display = 'flex';
          fetchSettings();
          fetchUsers().then(() => fetchRegistrations());
        } else {
          auth.signOut();
        }
      }).catch(() => hideLoader());
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
          if (doc.exists && doc.data().role === 'admin') {
            hideLoader();
            loginPanel.style.display = 'none';
            dashboardPanel.style.display = 'flex';
            fetchSettings();
            
            // Fetch users first so telecallersList is populated before rendering pending table
            fetchUsers().then(() => {
              fetchRegistrations();
            });
          } else {
            // Not an admin
            auth.signOut();
            throw new Error("Access Denied: You do not have administrator privileges.");
          }
        });
    })
    .catch((error) => {
      hideLoader();
      alert("Login Failed: " + error.message);
    });
});

// ==========================================
// 3. SETTINGS LOGIC (Firestore)
// ==========================================
function fetchSettings() {
  db.collection('settings').doc('config').get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        inputUpi.value = data.UPI_ID || '';
        inputAmount.value = data.AMOUNT || '';
        currentFeeAmount = parseInt(data.AMOUNT) || 299;
      }
    })
    .catch(err => console.error("Error fetching settings:", err));
}

btnSaveSettings.addEventListener('click', () => {
  if(!inputUpi.value || !inputAmount.value) {
    alert("Both UPI ID and Amount are required.");
    return;
  }
  
  showLoader("Saving configuration...");
  
  db.collection('settings').doc('config').set({
    UPI_ID: inputUpi.value,
    AMOUNT: inputAmount.value
  }, { merge: true })
  .then(() => {
    hideLoader();
    alert("Settings saved successfully.");
    currentFeeAmount = parseInt(inputAmount.value) || 299;
    processData(cachedData); // Recalculate revenue
  })
  .catch(err => {
    hideLoader();
    alert("Error saving settings: " + err.message);
  });
});

// ==========================================
// 4. DATA FETCHING (Firestore)
// ==========================================
let isListening = false;
function fetchRegistrations() {
  if (isListening) return; // Prevent multiple listeners
  showLoader('Syncing Secure Records...');
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
  const pending = rows.filter(r => r.status === 'Pending Verification');
  const leads = rows.filter(r => r.status === 'Uploaded Lead' || r.status === 'Cold Lead' || r.status === 'Hot Lead' || r.status === 'Follow-up Required');
  const approved = rows.filter(r => r.status === 'Approved');
  
  mTotal.innerText = pending.length + approved.length;
  mPending.innerText = pending.length;
  mApproved.innerText = approved.length;
  if (mRevenue) {
    mRevenue.innerText = `₹${(approved.length * currentFeeAmount).toLocaleString('en-IN')}`;
  }
  
  bPending.innerText = pending.length;
  bApproved.innerText = approved.length;
  if (bLeads) bLeads.innerText = leads.length;
  
  renderPendingTable(pending);
  renderApprovedTable(approved);
  if (tLeads) renderLeadsTable(leads);
}

// ==========================================
// 5. RENDER TABLES & LEAD ASSIGNMENT
// ==========================================
function renderPendingTable(rows) {
  tPending.innerHTML = '';
  
  if (rows.length === 0) {
    tPending.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No pending verifications! You are all caught up.</td></tr>';
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.registrationId}</strong></td>
      <td>
        <div style="font-weight: 600;">${row.fullName}</div>
        <div style="font-size: 0.8rem; color: var(--text-dark);">${row.email || 'N/A'}</div>
      </td>
      <td>${row.phone}</td>
      <td><div style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${row.course}">${row.course}</div></td>
      <td>
        <code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-weight: bold;">${row.utr}</code>
      </td>
      <td class="action-buttons">
        <button class="btn-sm btn-approve" onclick="approveRegistration('${row.registrationId}', '${row.email || ''}', '${row.fullName}', '${row.course}')">Verify & Approve</button>
        <button class="btn-sm btn-reject" onclick="rejectRegistration('${row.registrationId}', '${row.email || ''}', '${row.fullName}')">Reject</button>
      </td>
    `;
    tPending.appendChild(tr);
  });
}

function renderLeadsTable(rows) {
  tLeads.innerHTML = '';
  
  if (rows.length === 0) {
    tLeads.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No leads available.</td></tr>';
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.registrationId}</strong></td>
      <td>
        <div style="font-weight: 600;">${row.fullName}</div>
        <div style="font-size: 0.8rem; color: var(--text-dark);">${row.email || 'N/A'}</div>
      </td>
      <td>${row.phone}</td>
      <td><div style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${row.course}">${row.course}</div></td>
      <td class="action-buttons">
        <button class="btn-sm btn-reject" onclick="deleteRecord('${row.registrationId}', 'lead')">Delete</button>
      </td>
    `;
    tLeads.appendChild(tr);
  });
}

window.deleteRecord = function(regId, type = 'record') {
  if(!confirm(`Are you sure you want to delete this ${type}?`)) return;
  showLoader(`Deleting ${type}...`);
  db.collection('registrations').doc(regId).delete()
    .then(() => {
      hideLoader();
      fetchRegistrations();
    })
    .catch((err) => {
      hideLoader();
      alert(`Error deleting ${type}: ` + err.message);
    });
}

window.assignLead = function(regId, telecallerEmail) {
  showLoader("Assigning Lead...");
  db.collection('registrations').doc(regId).update({
    assignedTo: telecallerEmail || firebase.firestore.FieldValue.delete()
  })
  .then(() => {
    hideLoader();
    // Silently update cached data and re-render so we don't need a full fetch
    const lead = cachedData.find(r => r.registrationId === regId);
    if(lead) {
      if(telecallerEmail) lead.assignedTo = telecallerEmail;
      else delete lead.assignedTo;
    }
  })
  .catch((error) => {
    hideLoader();
    alert("Error assigning lead: " + error.message);
    fetchRegistrations(); // Refresh to reset dropdown
  });
}

function renderApprovedTable(rows) {
  tApproved.innerHTML = '';
  
  if (rows.length === 0) {
    tApproved.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No approved registrations yet.</td></tr>';
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    
    // WhatsApp formatting
    const waNumber = row.phone.replace(/[^0-9]/g, '');
    const waMessage = encodeURIComponent(
      `Hello ${row.fullName},\n\nWe have received your registration for the ${row.course}.\n\nRegistration ID: ${row.registrationId}\nPayment Status: ${row.status}\n\nYour seat is confirmed! We will update you shortly with orientation details.\n\n- The Thiranex Team`
    );
    
    tr.innerHTML = `
      <td><strong>${row.registrationId}</strong></td>
      <td>
        <div style="font-weight: 600;">${row.fullName}</div>
        <div style="font-size: 0.8rem; color: var(--text-dark);">${row.email || 'N/A'}</div>
      </td>
      <td>${row.phone}</td>
      <td><div style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${row.course}">${row.course}</div></td>
      <td><code style="background: #d1fae5; color: #047857; padding: 2px 4px; border-radius: 4px; font-weight: bold;">✓ ${row.utr || 'N/A'}</code></td>
      <td class="action-buttons">
        <button class="btn-sm btn-whatsapp" onclick="window.open('https://wa.me/91${waNumber}?text=${waMessage}', '_blank')">WhatsApp</button>
        <button class="btn-sm btn-reject" onclick="deleteRecord('${row.registrationId}', 'approved intern')">Delete</button>
      </td>
    `;
    tApproved.appendChild(tr);
  });
}

// ==========================================
// 6. BULK CSV UPLOAD
// ==========================================
const csvUploadFile = document.getElementById('csv-upload-file');

if (csvUploadFile) {
  csvUploadFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    showLoader("Parsing CSV...");
    
    const reader = new FileReader();
    reader.onload = function(event) {
      const text = event.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      if(lines.length < 2) {
        hideLoader();
        alert("The CSV file seems to be empty or missing data rows.");
        return;
      }
      
      // Skip header row
      const dataRows = lines.slice(1);
      const batch = db.batch();
      let count = 0;
      
      dataRows.forEach((row, idx) => {
        const cols = row.split(',');
        if(cols.length >= 2) {
          const fullName = cols[0] ? cols[0].trim() : '';
          const phone = cols[1] ? cols[1].trim() : '';
          const email = cols[2] ? cols[2].trim() : '';
          const course = cols[3] && cols[3].trim() ? cols[3].trim() : 'Fullstack Webdevelopment Training CuM Internship program';
          
          if(fullName && phone) {
            const timestamp = new Date();
            const yearCode = timestamp.getFullYear();
            // Ensure unique ID even for rapid batch processing
            const uniqueSuffix = Math.floor(1000 + Math.random() * 9000) + idx;
            const registrationId = `LEAD-${yearCode}-${uniqueSuffix}`;
            
            const docRef = db.collection('registrations').doc(registrationId);
            batch.set(docRef, {
              timestamp: timestamp.toISOString(),
              registrationId: registrationId,
              fullName: fullName,
              phone: phone,
              email: email,
              course: course,
              status: "Hot Lead",
              callNotes: []
            });
            count++;
          }
        }
      });
      
      if(count > 0) {
        showLoader(`Uploading ${count} leads...`);
        batch.commit().then(() => {
          hideLoader();
          alert(`Successfully uploaded ${count} leads!`);
          csvUploadFile.value = ''; // Reset input
          fetchRegistrations();
        }).catch(err => {
          hideLoader();
          alert("Error uploading leads: " + err.message);
        });
      } else {
        hideLoader();
        alert("No valid leads found in CSV.");
      }
    };
    reader.onerror = function() {
      hideLoader();
      alert("Error reading file.");
    };
    reader.readAsText(file);
  });
}

// ==========================================
// 7. APPROVAL & REJECTION ACTIONS (Firestore & EmailJS)
// ==========================================

// Initialize EmailJS with Public Key
emailjs.init("oJ_q83kQzovYDk9Ut");

function sendAutomatedEmail(to_email, to_name, subject, message, course = "", regId = "") {
  // If EmailJS is not configured, silently skip.
  if (!emailjs || !emailjs.send || !to_email) return Promise.resolve();
  
  return emailjs.send("service_4c4nenj", "template_fjir2m3", {
    to_email: to_email,
    to_name: to_name,
    subject: subject,
    message: message,
    course_name: course,
    registration_id: regId
  });
}

window.approveRegistration = function(regId, email, name, course) {
  if (!confirm(`Are you sure you want to verify payment for ${regId}?\n\nThis will instantly dispatch a confirmation email to the participant.`)) {
    return;
  }
  
  showLoader(`Verifying ${regId}...`);
  
  db.collection('registrations').doc(regId).update({
    status: 'Approved'
  })
  .then(() => {
    // Send email using EmailJS
    const msg = `Great news! Your payment has been successfully verified for the ${course}.\n\nRegistration ID: ${regId}\n\nYour seat is confirmed.`;
    return sendAutomatedEmail(email, name, "Payment Verified & Registration Confirmed!", msg, course, regId);
  })
  .then(() => {
    hideLoader();
    alert(`Success! Payment verified.`);
  })
  .catch((error) => {
    hideLoader();
    alert("Error processing approval: " + error.message);
  });
};

window.rejectRegistration = function(regId, email, name) {
  if (!confirm(`Are you sure you want to REJECT ${regId}?\n\nThis will instantly dispatch a cancellation email to the participant.`)) {
    return;
  }
  
  showLoader(`Rejecting ${regId}...`);
  
  db.collection('registrations').doc(regId).update({
    status: 'Rejected'
  })
  .then(() => {
    // Send email using EmailJS
    const msg = `Unfortunately, we could not verify your payment receipt or UTR number. As a result, your registration has been cancelled.\n\nIf you believe this is a mistake, please register again with valid payment details.`;
    return sendAutomatedEmail(email, name, "Action Required: Registration Cancelled", msg);
  })
  .then(() => {
    hideLoader();
    alert(`Registration rejected.`);
  })
  .catch((error) => {
    hideLoader();
    alert("Error processing rejection: " + error.message);
  });
};

// ==========================================
// 8. CSV REPORT GENERATION
// ==========================================
const btnExportCsv = document.getElementById('btn-export-csv');
if (btnExportCsv) {
  btnExportCsv.addEventListener('click', () => {
    const approvedRows = cachedData.filter(r => r.status === 'Approved');
    if (approvedRows.length === 0) {
      alert("No approved students to export.");
      return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Registration ID,Full Name,Email,Phone,Domain,Batch,Transaction UTR,Timestamp\n";
    
    approvedRows.forEach(row => {
      const rId = `"${row.registrationId}"`;
      const name = `"${row.fullName}"`;
      const email = `"${row.email || ''}"`;
      const phone = `"${row.phone}"`;
      const course = `"${row.course}"`;
      const batch = `"${row.batch || ''}"`;
      const utr = `"${row.utr || ''}"`;
      const time = `"${row.timestamp}"`;
      
      csvContent += `${rId},${name},${email},${phone},${course},${batch},${utr},${time}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Thiranex_Approved_Interns_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// Refresh Data Listener
btnRefresh.addEventListener('click', () => {
  fetchUsers().then(() => {
    fetchRegistrations();
  });
});

// ==========================================
// 9. TEAM ACCESS & USER MANAGEMENT (RBAC)
// ==========================================
const btnCreateUser = document.getElementById('btn-create-user');
const tUsers = document.getElementById('table-users');

function fetchUsers() {
  return db.collection('users').get()
    .then((snapshot) => {
      tUsers.innerHTML = '';
      telecallersList = []; // Reset global list
      
      if (snapshot.empty) {
        tUsers.innerHTML = '<tr><td colspan="3" style="text-align:center;">No users found.</td></tr>';
        return;
      }
      
      snapshot.forEach(doc => {
        const user = doc.data();
        telecallersList.push({ email: user.email, role: user.role });
        
        const tr = document.createElement('tr');
        
        let roleBadge = '';
        if (user.role === 'admin') {
          roleBadge = '<span style="background:var(--primary); color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">Admin</span>';
        } else {
          roleBadge = '<span style="background:var(--secondary); color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">Telecaller</span>';
        }
        
        let nameDisplay = user.name || `<span style="color: var(--text-muted); font-style: italic;">No Name Setup</span>`;
        
        tr.innerHTML = `
          <td><strong>${nameDisplay}</strong></td>
          <td>${user.email}</td>
          <td>${roleBadge}</td>
          <td><code style="font-size:0.8rem; color:var(--text-muted);">${doc.id}</code></td>
        `;
        tUsers.appendChild(tr);
      });
    })
    .catch(err => console.error("Error fetching users:", err));
}

if (btnCreateUser) {
  btnCreateUser.addEventListener('click', () => {
    const newName = document.getElementById('new-user-name').value.trim();
    const newEmail = document.getElementById('new-user-email').value.trim();
    const newPassword = document.getElementById('new-user-password').value;
    const newRole = document.getElementById('new-user-role').value;
    
    if (!newEmail || !newPassword || !newName) {
      alert("Please provide a name, email, and password.");
      return;
    }
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    showLoader("Creating new team member...");

    // Workaround: Use a secondary Firebase app to prevent logging out the current admin
    const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
    
    secondaryApp.auth().createUserWithEmailAndPassword(newEmail, newPassword)
      .then((userCredential) => {
        const newUid = userCredential.user.uid;
        // Save the role to Firestore using the PRIMARY app instance (which has admin rights)
        return db.collection('users').doc(newUid).set({
          name: newName,
          email: newEmail,
          role: newRole,
          createdAt: new Date().toISOString()
        }).then(() => {
          // Sign out and delete the secondary app
          return secondaryApp.auth().signOut();
        });
      })
      .then(() => {
        secondaryApp.delete();
        hideLoader();
        alert(`Successfully created new ${newRole} account for ${newEmail}!`);
        
        // Clear form
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        
        // Refresh table
        fetchUsers().then(() => fetchRegistrations());
      })
      .catch((error) => {
        hideLoader();
        alert("Error creating user: " + error.message);
        try { secondaryApp.delete(); } catch(e){}
      });
  });
}
