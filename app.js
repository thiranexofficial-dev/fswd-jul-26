/**
 * Thiranex Internship Registration Form - Client-side Controller
 * Powered by Firebase
 */

// ==========================================
// CONFIGURATION
// ==========================================

// Form Fields State
const formData = {
  fullName: '',
  email: '',
  phone: '',
  college: '',
  department: '',
  academicYear: '',
  course: 'Full Stack Web Development',
  batch: '',
  referral: '',
  utr: ''
};

// UI Elements
const form = document.getElementById('registration-form');
const card = document.getElementById('form-card');
const steps = document.querySelectorAll('.form-step');
const stepItems = document.querySelectorAll('.step-item');
const progressBar = document.getElementById('progress-bar');

// Button controls
const btnBack = document.getElementById('btn-back');
const btnNext = document.getElementById('btn-next');
const btnNextIcon = document.getElementById('btn-next-icon');

// QR and Copy elements
const qrImage = document.getElementById('qr-code-img');
const qrLoadingSpinner = document.getElementById('qr-loading-spinner');
const copyUpiBtn = document.getElementById('copy-upi-btn');

// Overlays and Success elements
const loadingOverlay = document.getElementById('loading-overlay');
const loadingTitle = document.getElementById('loading-title');
const loadingStatus = document.getElementById('loading-status');
const successPanel = document.getElementById('success-panel');

const btnRestart = document.getElementById('btn-restart');
const btnPrint = document.getElementById('btn-print');

// State Variables
let currentStep = 1;
const totalSteps = 3;

// UPI Configuration
let UPI_ID = 'thiranix@ybl';
const BUSINESS_NAME = 'Thiranex';
let REGISTRATION_FEE = 299;

// Init Function
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupValidationListeners();
  
  // Extract referral link parameter if present
  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get('t') || urlParams.get('token');
  const refParam = urlParams.get('ref');
  
  if (tokenParam) {
    try {
      // Re-add standard base64 padding if stripped
      const padded = tokenParam.padEnd(tokenParam.length + (4 - tokenParam.length % 4) % 4, '=');
      let decoded = atob(padded);
      if (!decoded.includes('@')) decoded += '@thiranex.com';
      formData.referredBy = decoded;
    } catch(e) {
      console.error('Invalid token format');
    }
  } else if (refParam) {
    formData.referredBy = refParam; // Keep old support for existing links
  }

  fetchDynamicSettings(); // This will fetch settings and then call setupQRAndUpi()
  setupSuccessActions();
});

// ==========================================
// 1. STEP NAVIGATION
// ==========================================
function setupNavigation() {
  btnNext.addEventListener('click', () => {
    if (currentStep < totalSteps) {
      if (validateCurrentStep()) {
        currentStep++;
        updateStepUI();
      }
    } else {
      // We are on Step 3: Handle Final Form Submission
      if (validateCurrentStep()) {
        submitRegistration();
      }
    }
  });

  btnBack.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateStepUI();
    }
  });
}

function updateStepUI() {
  // Update step panels visibility
  steps.forEach(step => {
    step.classList.remove('active');
    if (parseInt(step.dataset.step) === currentStep) {
      step.classList.add('active');
    }
  });

  // Update step indicators
  stepItems.forEach(item => {
    const itemStep = parseInt(item.dataset.step);
    item.classList.remove('active', 'completed');
    
    if (itemStep === currentStep) {
      item.classList.add('active');
    } else if (itemStep < currentStep) {
      item.classList.add('completed');
    }
  });

  // Update Progress Bar
  const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;
  progressBar.style.width = `${progressPercent}%`;

  // Update Back/Next Button Labels & States
  btnBack.disabled = currentStep === 1;

  if (currentStep === totalSteps) {
    btnNext.innerHTML = `
      Submit
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    `;
    btnNext.classList.add('btn-primary-success');
  } else {
    btnNext.innerHTML = `
      Next
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" id="btn-next-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    `;
    btnNext.classList.remove('btn-primary-success');
  }

  // Auto scroll to top of card on step change (good for mobile)
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==========================================
// 2. INPUT VALIDATION
// ==========================================
const validators = {
  fullName: (value) => {
    return /^[a-zA-Z\s]{3,50}$/.test(value.trim());
  },
  email: (value) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim());
  },
  phone: (value) => {
    return /^[6-9]\d{9}$/.test(value.trim());
  },
  college: (value) => {
    return value.trim().length >= 3;
  },
  department: (value) => {
    return value.trim().length >= 2;
  },
  academicYear: (value) => {
    return value !== '';
  },
  batch: (value) => {
    return value !== '';
  },
  utr: (value) => {
    return /^\d{12}$/.test(value.trim());
  }
};

function setupValidationListeners() {
  const fields = ['fullName', 'email', 'phone', 'college', 'department', 'academicYear', 'batch', 'utr'];
  
  fields.forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (!input) return;

    const validate = () => {
      const isValid = validators[fieldId](input.value);
      const errorMsg = document.getElementById(`error-${fieldId}`);
      
      if (isValid) {
        input.style.borderColor = '';
        if (errorMsg) errorMsg.classList.remove('visible');
      }
    };

    input.addEventListener('input', validate);
    input.addEventListener('change', validate);
  });
}

function showFieldError(fieldId, show = true) {
  const input = document.getElementById(fieldId);
  const errorMsg = document.getElementById(`error-${fieldId}`);
  
  if (!input) return;
  
  if (show) {
    input.style.borderColor = 'var(--error)';
    if (errorMsg) errorMsg.classList.add('visible');
  } else {
    input.style.borderColor = '';
    if (errorMsg) errorMsg.classList.remove('visible');
  }
}

function validateCurrentStep() {
  let isStepValid = true;

  if (currentStep === 1) {
    const step1Fields = ['fullName', 'email', 'phone', 'college', 'department', 'academicYear'];
    step1Fields.forEach(fieldId => {
      const input = document.getElementById(fieldId);
      const isValid = validators[fieldId](input.value);
      showFieldError(fieldId, !isValid);
      if (!isValid) isStepValid = false;
    });
  } 
  else if (currentStep === 2) {
    const step2Fields = ['batch'];
    step2Fields.forEach(fieldId => {
      const input = document.getElementById(fieldId);
      const isValid = validators[fieldId](input.value);
      showFieldError(fieldId, !isValid);
      if (!isValid) isStepValid = false;
    });
  } 
  else if (currentStep === 3) {
    const utrInput = document.getElementById('utr');
    const chkTerms = document.getElementById('chk-terms');
    const chkRefund = document.getElementById('chk-refund');
    const errorTerms = document.getElementById('error-terms');
    
    const isUtrValid = validators.utr(utrInput.value);
    showFieldError('utr', !isUtrValid);
    if (!isUtrValid) isStepValid = false;

    if (!chkTerms.checked || !chkRefund.checked) {
      errorTerms.style.display = 'block';
      isStepValid = false;
    } else {
      errorTerms.style.display = 'none';
    }
  }

  return isStepValid;
}

// ==========================================
// 3. QR GENERATION & UPI COPY
// ==========================================
function fetchDynamicSettings() {
  db.collection('settings').doc('config').get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data.UPI_ID) UPI_ID = data.UPI_ID;
        if (data.AMOUNT) REGISTRATION_FEE = data.AMOUNT;
      } else {
        console.warn("No settings found in Firebase, using defaults.");
        db.collection('settings').doc('config').set({
          UPI_ID: 'thiranix@ybl',
          AMOUNT: '299'
        }).catch(e => console.error("Could not set defaults", e));
      }
      updatePaymentUI();
      setupQRAndUpi();
    })
    .catch((error) => {
      console.error("Failed to fetch settings from Firebase, using defaults.", error);
      updatePaymentUI();
      setupQRAndUpi();
    });
}

function updatePaymentUI() {
  const feeBadge = document.getElementById('fee-badge-display');
  if (feeBadge) feeBadge.innerText = `₹${REGISTRATION_FEE}`;
  if (copyUpiBtn) copyUpiBtn.innerText = UPI_ID;
}

function setupQRAndUpi() {
  const note = encodeURIComponent('Internship Reg Fee');
  const upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(BUSINESS_NAME)}&am=${REGISTRATION_FEE}&cu=INR&tn=${note}`;
  
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}&color=1e40af&bgcolor=ffffff`;
  
  qrImage.src = qrUrl;
  
  qrImage.onload = () => {
    qrLoadingSpinner.style.display = 'none';
  };

  if (copyUpiBtn) {
    copyUpiBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(UPI_ID).then(() => {
        const originalText = copyUpiBtn.innerText;
        copyUpiBtn.innerText = 'Copied!';
        copyUpiBtn.style.color = 'var(--success)';
        copyUpiBtn.style.background = 'rgba(16, 185, 129, 0.15)';
        copyUpiBtn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        
        setTimeout(() => {
          copyUpiBtn.innerText = originalText;
          copyUpiBtn.style.color = '';
          copyUpiBtn.style.background = '';
          copyUpiBtn.style.borderColor = '';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    });
  }
}

// ==========================================
// 4. REGISTRATION SUBMISSION (TO FIREBASE)
// ==========================================
function submitRegistration() {
  // Capture final fields
  formData.fullName = document.getElementById('fullName').value.trim();
  formData.email = document.getElementById('email').value.trim();
  formData.phone = document.getElementById('phone').value.trim();
  formData.college = document.getElementById('college').value.trim();
  formData.department = document.getElementById('department').value.trim();
  formData.academicYear = document.getElementById('academicYear').value;
  formData.course = document.getElementById('course').value;
  formData.batch = document.getElementById('batch').value;
  formData.referral = document.getElementById('referral').value;
  formData.utr = document.getElementById('utr').value.trim();

  // Activate loading overlay
  loadingOverlay.classList.add('active');
  loadingTitle.innerText = 'Submitting Registration';
  loadingStatus.innerText = 'Saving registration securely...';
  
  // 1. Generate unique Registration ID
  const timestamp = new Date();
  const yearCode = timestamp.getFullYear();
  const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
  const registrationId = `TX-${yearCode}-${uniqueSuffix}`;

  // 2. Save data directly to Firestore (No image upload anymore)
  db.collection('registrations').doc(registrationId).set({
    timestamp: timestamp.toISOString(),
    registrationId: registrationId,
    fullName: formData.fullName,
    email: formData.email,
    phone: formData.phone,
    college: formData.college,
    department: formData.department,
    academicYear: formData.academicYear,
    course: formData.course,
    batch: formData.batch,
    referral: formData.referral || "Direct", // The source input field
    referredBy: formData.referredBy || null, // The telecaller's ?ref= tracking
    utr: formData.utr,
    status: "Pending Verification"
  })
  .then(() => {
    // 3. Cleanup Old Leads (prevent duplicates in telecaller queue)
    cleanupOldLeads(formData.email, formData.phone);
    
    loadingOverlay.classList.remove('active');
    showSuccessPage(registrationId);
  })
  .catch((error) => {
    console.error('Error submitting form:', error);
    loadingOverlay.classList.remove('active');
    alert("There was an error submitting your registration. Please try again.");
  });
}

function cleanupOldLeads(email, phone) {
  const statusesToRemove = ['Uploaded Lead', 'Hot Lead', 'Cold Lead', 'Follow-up Required'];

  if (email) {
    db.collection('registrations').where('email', '==', email).get()
      .then(snap => {
        snap.forEach(doc => {
          if (statusesToRemove.includes(doc.data().status)) doc.ref.delete();
        });
      }).catch(e => console.error("Cleanup error (email):", e));
  }
  
  if (phone) {
    db.collection('registrations').where('phone', '==', phone).get()
      .then(snap => {
        snap.forEach(doc => {
          if (statusesToRemove.includes(doc.data().status)) doc.ref.delete();
        });
      }).catch(e => console.error("Cleanup error (phone):", e));
  }
}

// ==========================================
// 5. SUCCESS PANEL & PRINTING
// ==========================================
function showSuccessPage(regId) {
  const dateObj = new Date();
  const yearCode = dateObj.getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const finalRegId = regId || `TX-${yearCode}-${randomSuffix}`;

  document.getElementById('receipt-id').innerText = finalRegId;
  document.getElementById('receipt-name').innerText = formData.fullName;
  document.getElementById('receipt-email').innerText = formData.email;
  document.getElementById('receipt-phone').innerText = formData.phone;
  document.getElementById('receipt-course').innerText = formData.course;
  document.getElementById('receipt-batch').innerText = formData.batch;
  document.getElementById('receipt-utr').innerText = formData.utr;
  document.getElementById('receipt-date').innerText = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  document.getElementById('step-indicator').style.display = 'none';
  form.style.display = 'none';
  
  successPanel.classList.add('active');
}

function setupSuccessActions() {
  btnRestart.addEventListener('click', () => {
    form.reset();
    
    const errors = document.querySelectorAll('.error-message');
    errors.forEach(e => e.classList.remove('visible'));
    
    const inputs = document.querySelectorAll('.form-control');
    inputs.forEach(i => i.style.borderColor = '');

    successPanel.classList.remove('active');
    document.getElementById('step-indicator').style.display = 'flex';
    form.style.display = 'block';

    currentStep = 1;
    updateStepUI();
  });

  btnPrint.addEventListener('click', () => {
    window.print();
  });
}
