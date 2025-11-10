// Configuration
const SUPABASE_URL = "https://myywayfyfvdqnukaiecd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15eXdheWZ5ZnZkcW51a2FpZWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2OTg1NzYsImV4cCI6MjA3NzI3NDU3Nn0.R12_dB-qYcLED7jdU49FT8KjV3a6S3FyfYR8Yds9_4U";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentTaskFilter = 'all';

// Load DOM

document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

// Authentication

async function handleAuth() {
  const name = document.getElementById('authName').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorElement = document.getElementById('authError');
  
  if (!name) {
    errorElement.textContent = 'Please enter your username';
    return;
  }
  
  const emailForAuth = `${encodeURIComponent(name)}@guitarjournal.example.com`;
  
  try {
    const { data, error: checkExistError } = await supabase.auth.signInWithPassword({
      email: emailForAuth,
      password: password
    })
    
    if (checkExistError && checkExistError.message.includes('Invalid login credentials')) {
            
      // Create new user
      const { data: signUpData, error: createError } = await supabase.auth.signUp({
        email: emailForAuth,
        password: password
      })

      if (createError) throw createError;
      
      await createProfile(signUpData.user.id, name, password);
    }
  } catch (e) {
    console.error('Signup check error:', e);
    errorElement.textContent = (e.message) ? e.message : 'Unexpected error occurred';
  }

  // Try sign in
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email: emailForAuth,
    password: password
  });
  if (signInError) throw signInError;  

  await loadAppAfterAuth();

}

async function createProfile(userId, username, password) {
  const { error } = await supabase
    .from('profiles')
    .insert([{ id: userId, username: username, password: password, week_count_task: 0, created_at: new Date(), admin: false }]);
  if (error) throw error;
}

async function loadAppAfterAuth() {
  // Get the authenticated user and profile and initialize app UI
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData) {
    // not authenticated
    return;
  }

  // Optionally fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  window.currentUser = { user: userData.user, profile: profile };

  // Hide auth UI, show app, initialize data loads
  showMainApp();
}

// General Event Listeners

function initializeEventListeners() {
    // Auth input enter keys
    document.getElementById('authName').addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        const passwordSection = document.getElementById('authPasswordSection');
        if (passwordSection.style.display === 'none') {
            handleAuth();
        } else {
            document.getElementById('authPassword').focus();
        }
      }
    });

    document.getElementById('authPassword').addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        const confirmSection = document.getElementById('confirmPasswordSection');
        if (confirmSection.style.display === 'none') {
            handleAuth();
        } else {
            document.getElementById('authConfirmPassword').focus();
        }
      }
    });

    document.getElementById('authConfirmPassword').addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
          handleAuth();
      }
    });

    // Task input enter key
    document.getElementById('task-text').addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        addTask();
      }
    });

    // Task filter buttons
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('filter')) {
        currentTaskFilter = e.target.dataset.filter;
        currentUserFilter = '';
        
        // Update active button
        document.querySelectorAll('.filter').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
        
        // Filter tasks
        filterTasks();
      }
    });
}

//Dependent functions

function showMainApp() {
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('authSubmit').textContent = 'Login';
  
 // Initialize app
  loadTasks();
  loadWeeks();
}

function logout() {
  currentUser = null;
  document.getElementById('authModal').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'none';
  
  // Reset form
  document.getElementById('authName').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authConfirmPassword').value = '';
  document.getElementById('authPasswordSection').style.display = 'none';
  document.getElementById('confirmPasswordSection').style.display = 'none';
  document.getElementById('authSubmit').textContent = 'Continue';
  document.getElementById('authError').textContent = '';
}
