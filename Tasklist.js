const colors = ['#016B61', '#70B2B2', '#9ECFD4', '#E5E9C5'];

async function loadTasks() {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
                *, 
                profiles(username) 
            `)
            .order('created_at', { ascending: true });

        if (error) throw error;

        window.allTasks = tasks; // Store for filtering
        filterTasks();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

const taskTags = [
    {name: 'Play', color: '#70B2B2'},
    {name: 'Theory', color: '#9ECFD4'},
    {name: 'Dev', color: '#E5E9C5'}
]
function getDefaultTagName(color) {
    const defaultNames = {
        '#016B61': 'All',
        '#70B2B2': 'Play',
        '#9ECFD4': 'Theory',
        '#E5E9C5': 'Dev',
    };
    return defaultNames[color] || 'Unnamed';
}

function filterTasks() {
    if (!window.allTasks) return;
    
    let filteredTasks = window.allTasks;
    
    switch (currentTaskFilter) {
        case 'play':
            filteredTasks = window.allTasks.filter(task => task.tag_id === 'Play');
            break;
        case 'theory':
            filteredTasks = window.allTasks.filter(task => task.tag_id === 'Theory');
            break;
        case 'dev':
            filteredTasks = window.allTasks.filter(task => task.tag_id === 'Dev');
            break
        default:
            filteredTasks = window.allTasks;
            break;
    }
    
    displayTasks(filteredTasks);
}

function displayTasks(tasks) {
    const tasksList = document.getElementById('tasks');
    tasksList.innerHTML = '';

    tasks.forEach(task => {
        const li = document.createElement('li');
        li.dataset.taskId = task.id;

        const canModify = currentUser.profile.admin === true;
        const tagInfo = taskTags.find(t => t.name === task.tag_id) || { color: '#CCC', name: 'No Tag' };

        li.innerHTML = `
        ${canModify ? `<button class="done" onclick="markDone(this.parentNode)">✓</button>` : ''}
        ${canModify ? `<button class="remove" onclick="removeTask(this.parentNode)">✕</button>` : ''}
        ${canModify ? createTagSelector(task.tag_id) : `<div class="tag-display" style="background-color: ${tagInfo.color}">${tagInfo.name}</div>`}
        <span class="task-content">${task.task_text}</span>
        `;

        if (task.is_done) li.classList.add('finished');

        if (canModify) {
        setupTagSelector(li, task.id);
        }

        tasksList.appendChild(li);
    });
}


// Add this global click listener flag
let globalClickListenerAttached = false;

function setupTagSelector(taskElement, taskId) {
    const tagDisplay = taskElement.querySelector('.tag-display');
    const dropdown = taskElement.querySelector('.tag-dropdown');

    if (!tagDisplay || !dropdown) return;

    // Toggle dropdown
    tagDisplay.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.tag-dropdown.show').forEach(d => {
        if (d !== dropdown) d.classList.remove('show');
        });
        dropdown.classList.toggle('show');
    });

    // Handle tag click
    dropdown.querySelectorAll('.tag-option').forEach(option => {
        option.addEventListener('click', async e => {
        e.stopPropagation();
        const tagName = e.target.dataset.tag;
        dropdown.classList.remove('show');
        await updateTaskTag(taskId, tagName);
        });
    });

    // Global click to close dropdowns
    document.addEventListener('click', e => {
        if (!e.target.closest('.tag-selector')) {
        dropdown.classList.remove('show');
        }
    });
}


function createTagSelector(currentTagName) {
  const currentTag = taskTags.find(t => t.name === currentTagName) || taskTags[0];
  
  return `
    <div class="tag-selector">
      <div class="tag-display editable"
           style="background-color: ${currentTag.color}"
           data-tag="${currentTag.name}"
           title="Click to change tag">
        ${currentTag.name}
        <div class="tag-dropdown">
          ${taskTags.map(tag => `
            <div class="tag-option"
                 style="background-color: ${tag.color}"
                 data-tag="${tag.name}"
                 title="${tag.name}">
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

async function updateTaskTag(taskId, tagName) {
  try {
    const { data, error } = await supabase
        .from('tasks')
        .update({ tag_id: tagName })
        .eq('id', taskId)
        .select();

    if (error) throw error;

    // Update local state
    const task = window.allTasks.find(t => t.id === taskId);
    if (task) task.tag_id = tagName;

    await loadTasks();
  } catch (error) {
    console.error('Error updating tag:', error);
    alert('Failed to update tag. Please try again.');
  }
}

// New function to handle task editing
async function editTask(taskElement, taskId, currentText) {
    const taskContentSpan = taskElement.querySelector('.task-content');
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'task-edit-input';
    
    // Style the input
    input.style.border = '1px solid #ccc';
    input.style.padding = '2px 4px';
    input.style.fontSize = 'inherit';
    input.style.fontFamily = 'inherit';
    input.style.width = '200px';
    input.style.backgroundColor = '#fff';
    
    // Replace span with input
    taskContentSpan.style.display = 'none';
    taskElement.insertBefore(input, taskContentSpan);
    
    input.focus();
    input.select();
    
    const saveEdit = async () => {
        const newText = input.value.trim();
        
        if (!newText) {
            alert('Task cannot be empty!');
            input.focus();
            return;
        }
        
        if (newText === currentText) {
            cancelEdit();
            return;
        }
        
        try {
            const { error } = await supabase
                .from('tasks')
                .update({ task_text: newText })
                .eq('id', taskId);

            if (error) throw error;

            taskContentSpan.textContent = newText;
            cancelEdit();
            
        } catch (error) {
            console.error('Error updating task:', error);
            alert('Failed to update task. Please try again.');
            input.focus();
        }
    };
    
    const cancelEdit = () => {
        taskElement.removeChild(input);
        taskContentSpan.style.display = '';
        input.removeEventListener('blur', handleBlur);
        input.removeEventListener('keydown', handleKeydown);
    };
    
    const handleBlur = (e) => {
        setTimeout(() => {
            if (document.contains(input)) {
                saveEdit();
            }
        }, 100);
    };
    
    const handleKeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    };
    
    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', handleKeydown);
}

async function addTask() {
    const taskInput = document.getElementById('task-text');
    const taskText = taskInput.value.trim();

    if (!taskText) {
        alert('Please enter a task!');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('tasks')
            .insert([{
                user_id: currentUser.user.id,
                task_text: taskText,
                is_done: false,
                tag_id: null
            }])
            .select();
        if (error) throw error;

        taskInput.value = '';
        loadTasks();
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Failed to add task. Please try again.');
    }
}

async function markDone(taskElement) {
    const taskId = taskElement.dataset.taskId;
    const isDone = !taskElement.classList.contains('finished');

    try {
        const { error } = await supabase
            .from('tasks')
            .update([{ 
                is_done: true,
                completed_at: new Date() 
            }])
            .eq('id', taskId);
        if (error) throw error;

        if (isDone) {
            // Increment task completion count
            await supabase
                .from('profiles')
                .update({ 
                    week_count_task: currentUser.profile.week_count_task + 1
                })
                .eq('id', currentUser.user.id);
            
            currentUser.profile.week_count_task++;
        }

        loadTasks();
        loadWeeks();
    } catch (error) {
        console.error('Error updating task:', error);
    }
}

async function removeTask(taskElement) {
    const taskId = taskElement.dataset.taskId;

    try {
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId);

        if (error) throw error;

        loadTasks();
    } catch (error) {
        console.error('Error removing task:', error);
    }
}

