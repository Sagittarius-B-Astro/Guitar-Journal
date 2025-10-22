// Configruation
const SUPABASE_URL = "https://my_supabase";
const SUPABASE_ANON_KEY = "my_supabase_anon_key";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAIL = "my email";

let currentUser = null;

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
