// Configuration
const SUPABASE_URL = "https://my_supabase";
const SUPABASE_ANON_KEY = "my_supabase_anon_key";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAIL = "my email";

let currentUser = null;

// Load DOM

document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

// Authentication

async function checkUserSession() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;
  updateUIForUser();
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert("Login failed: " + error.message);
  } else {
    currentUser = data.user;
    updateUIForUser();
  }
}

async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  updateUIForUser();
}

function updateUIForUser() {
  const adminElements = document.querySelectorAll(".admin-only");
  if (currentUser && currentUser.email === ADMIN_EMAIL) {
    adminElements.forEach(el => el.style.display = "inline-block");
  } else {
    adminElements.forEach(el => el.style.display = "none");
  }
  loadTasks(activeCategory);
}

async function handleAuth() {
    const name = document.getElementById('authName').value.trim();
    const password = document.getElementById('authPassword').value;
    const confirmPassword = document.getElementById('authConfirmPassword').value;
    const errorElement = document.getElementById('authError');
    
    if (!name) {
        errorElement.textContent = 'Please enter your name';
        return;
    }
    
    try {
        // Check if user exists
        const { data: existingUser, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', name)
            .single();
            
        if (existingUser) {
            // User exists, verify password
            if (!password) {
                showPasswordInput();
                return;
            }
            
            if (existingUser.password === password) {
                // Update last login time
                await supabase
                    .from('users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', existingUser.id);
                
                // Login successful - set current user with updated last_login
                currentUser = { ...existingUser, last_login: new Date().toISOString() };
                
                // Check for calendar-based resets (affects all users)
                // await checkCalendarResets(); //supabase does not have this function, need to fix
                
                showMainApp();
            } else {
                errorElement.textContent = 'Incorrect password';
            }
        } else {
            // New user, create account
            if (!password) {
                showPasswordCreation();
                return;
            }
            
            if (password !== confirmPassword) {
                errorElement.textContent = 'Passwords do not match';
                return;
            }
            
            if (password.length < 4) {
                errorElement.textContent = 'Password must be at least 4 characters';
                return;
            }
            
            // Create new user
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert([{
                    username: name,
                    password: password,
                    tasks_completed: 0,
                    week_count_task: 0,
                    last_login: new Date().toISOString()
                }])
                .select()
                .single();
                
            if (createError) throw createError;
            
            currentUser = newUser;
            
            // Check for calendar-based resets (affects all users)
            await checkCalendarResets();
            
            showMainApp();
        }
    } catch (error) {
        console.error('Auth error:', error);
        errorElement.textContent = 'Authentication failed. Please try again.';
    }
}

// General Event Listeners

function initializeEventListeners() {
    // Task input enter key
    document.getElementById('taskInput').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            addTask();
        }
    });

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

function showPasswordInput() {
    document.getElementById('authPasswordSection').style.display = 'block';
    document.getElementById('authPassword').focus();
    document.getElementById('authSubmit').textContent = 'Login';
}

function showPasswordCreation() {
    document.getElementById('authPasswordSection').style.display = 'block';
    document.getElementById('confirmPasswordSection').style.display = 'block';
    document.getElementById('authPassword').placeholder = 'Create password (min 4 chars)';
    document.getElementById('authPassword').focus();
    document.getElementById('authSubmit').textContent = 'Create Account';
}

function showMainApp() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('currentUser').textContent = currentUser.username;
    
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
