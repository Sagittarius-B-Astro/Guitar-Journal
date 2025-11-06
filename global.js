// Configuration
const SUPABASE_URL = "https://myywayfyfvdqnukaiecd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15eXdheWZ5ZnZkcW51a2FpZWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2OTg1NzYsImV4cCI6MjA3NzI3NDU3Nn0.R12_dB-qYcLED7jdU49FT8KjV3a6S3FyfYR8Yds9_4U";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  const { data: user } = await supabase.auth.getUser();
  if (!user) {
    // not authenticated
    return;
  }

  // Optionally fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  window.currentUser = { authUser: user, profile };

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
    document.getElementById('taskInput').addEventListener('keypress', function(event) {
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
        
        // Reset user filter dropdown
        document.getElementById('userFilter').value = '';
        
        // Filter tasks
        filterTasks();
      }
    });
}

//Dependent functions

function showMainApp() {
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('currentUser').textContent = currentUser.username;
  document.getElementById('authSubmit').textContent = 'Login';
  
  // Initialize app
  loadTasks();
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

// Task edit

const categories = ["All", "Composition / Cover", "Ear Training / Theory / Tab", "Website Dev"];
let activeCategory = "All";

function setActiveCategory(category) {
  activeCategory = category;
  document.querySelectorAll(".category-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.category === category);
  });
  loadTasks(category);
}

async function loadTasks(filterCategory = "All") {
  let query = supabase.from("tasks").select("*").order("id", { ascending: false });

  if (filterCategory !== "All") {
    query = query.eq("category", filterCategory);
  }

  const { data: tasks, error } = await query;

  if (error) {
    console.error("Error loading tasks:", error);
    return;
  }

  renderTasks(tasks);
}

function renderTasks(tasks) {
  const container = document.getElementById("taskList");
  container.innerHTML = "";

  tasks.forEach(task => {
    const li = document.createElement("li");
    li.className = "task-item" + (task.is_done ? " finished" : "");
    li.dataset.taskId = task.id;

    const text = document.createElement("span");
    text.textContent = `${task.task_text} (${task.category})`;
    li.appendChild(text);

    if (currentUser && currentUser.email === ADMIN_EMAIL) {
      const doneBtn = document.createElement("button");
      doneBtn.textContent = task.is_done ? "Undo" : "Done";
      doneBtn.onclick = () => markDone(li);
      li.appendChild(doneBtn);

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.onclick = () => removeTask(li);
      li.appendChild(delBtn);
    }

    container.appendChild(li);
  });
}

async function addTask() {
  const input = document.getElementById("taskInput");
  const category = document.getElementById("categorySelect").value;
  const taskText = input.value.trim();

  if (!taskText) {
    alert("Please enter a task!");
    return;
  }

  try {
    const { error } = await supabase.from("tasks").insert([{
      user_id: currentUser.id,
      task_text: taskText,
      is_done: false,
      category: category
    }]);

    if (error) throw error;

    input.value = "";
    loadTasks(activeCategory);
  } catch (err) {
    console.error("Error adding task:", err);
  }
}

async function markDone(taskElement) {
  const taskId = taskElement.dataset.taskId;
  const isDone = !taskElement.classList.contains("finished");

  try {
    const { error } = await supabase
      .from("tasks")
      .update({ is_done: isDone })
      .eq("id", taskId);

    if (error) throw error;

    loadTasks(activeCategory);
  } catch (err) {
    console.error("Error updating task:", err);
  }
}

async function removeTask(taskElement) {
  const taskId = taskElement.dataset.taskId;

  try {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) throw error;
    loadTasks(activeCategory);
  } catch (err) {
    console.error("Error removing task:", err);
  }
}

//Initialization

document.addEventListener("DOMContentLoaded", () => {
  const categoryContainer = document.getElementById("categoryButtons");
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.classList.add("category-btn");
    btn.dataset.category = cat;
    btn.onclick = () => setActiveCategory(cat);
    if (cat === "All") btn.classList.add("active");
    categoryContainer.appendChild(btn);
  });

  checkUserSession();
});
