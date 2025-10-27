const colors = ['#016B61', '#70B2B2', '#9ECFD4', '#E5E9C5'];

async function loadTasks() {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks_v3')
            .select(`
                *, 
                users_v3(username),
                tags_v3(color, tag_name)
            `)
            .order('created_at', { ascending: true });

        if (error) throw error;

        window.allTasks = tasks; // Store for filtering
        filterTasks();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function getDefaultTagName(color) {
    const defaultNames = {
        '#FF6B6B': 'Priority',
        '#77DD77': 'Work',
        '#45B7D1': 'Personal',
        '#f7ac3b': 'Learning',
        '#DDA0DD': 'Fun'
    };
    return defaultNames[color] || 'Unnamed';
}

function filterTasks() {
    if (!window.allTasks) return;
    
    let filteredTasks = window.allTasks;
    
    switch (currentTaskFilter) {
        case 'my':
            filteredTasks = window.allTasks.filter(task => task.user_id === currentUser.id);
            
            // Apply tag filter if active
            if (currentTagFilter !== null) {
                filteredTasks = filteredTasks.filter(task => task.tag_id === currentTagFilter);
            }
            
            // Sort by priority: red tags first, then by creation date
            filteredTasks.sort((a, b) => {
                const aIsRed = a.tags_v3?.color === '#FF6B6B';
                const bIsRed = b.tags_v3?.color === '#FF6B6B';
                
                if (aIsRed && !bIsRed) return -1;
                if (!aIsRed && bIsRed) return 1;
                
                return new Date(a.created_at) - new Date(b.created_at);
            });
            
            // Show tag filter bar
            displayTagFilterBar();
            break;
        case 'others':
            filteredTasks = window.allTasks.filter(task => task.user_id !== currentUser.id);
            // Hide tag filter bar
            const existingBar = document.querySelector('.tag-filter-bar');
            if (existingBar) existingBar.remove();
            break;
        case 'user':
            if (currentUserFilter) {
                filteredTasks = window.allTasks.filter(task => task.users_v3.username === currentUserFilter);
            }
            // Hide tag filter bar
            const existingBar2 = document.querySelector('.tag-filter-bar');
            if (existingBar2) existingBar2.remove();
            break;
        case 'all':
        default:
            filteredTasks = window.allTasks;
            // Hide tag filter bar
            const existingBar3 = document.querySelector('.tag-filter-bar');
            if (existingBar3) existingBar3.remove();
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
        
        const canModify = currentUser && task.user_id === currentUser.id;
        
        // Create tag element
        const tagColor = task.tags_v3?.color || '#CCCCCC';
        const tagName = task.tags_v3?.tag_name || 'No Tag';
        
        li.innerHTML = `
            ${canModify ? `<button class="done" onclick="markDone(this.parentNode)">✓</button>` : ''}
            ${canModify ? `<button class="remove" onclick="removeTask(this.parentNode)">✕</button>` : ''}
            ${canModify ? createTagSelector(task.tag_id, tagColor, tagName) : `<div class="tag-display" style="background-color: ${tagColor}">${tagName}</div>`}
            <span class="task-content">${task.task_text}</span>
            <span class="task-owner">by ${task.users_v3.username}</span>
        `;

        if (task.is_done) {
            li.classList.add('finished');
        }

        // Add event listeners only for user's own tasks
        if (canModify) {
            const taskContentSpan = li.querySelector('.task-content');
            taskContentSpan.addEventListener('dblclick', function() {
                editTask(li, task.id, task.task_text);
            });
            taskContentSpan.style.cursor = 'pointer';
            taskContentSpan.title = 'Double-click to edit';
            
            // Setup tag functionality
            setupTagSelector(li, task.id, task.tag_id);
        }

        tasksList.appendChild(li);
    });
}

function createTagSelector(currentTagId, currentColor, currentTagName) {
    // Display as tag label (like other users) but with dropdown functionality
    return `
        <div class="tag-selector">
            <div class="tag-display editable" style="background-color: ${currentColor}" data-tag-id="${currentTagId || ''}" title="Click to change tag">
                ${currentTagName}
                <div class="tag-dropdown">
                    ${colors.map(color => {
                        const tagForColor = window.userTags?.find(tag => tag.color === color);
                        const tagName = tagForColor?.tag_name || getDefaultTagName(color);
                        return `
                            <div class="tag-option" 
                                 style="background-color: ${color}" 
                                 data-color="${color}" 
                                 title="${tagName}">
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

// Add this global click listener flag
let globalClickListenerAttached = false;

function setupTagSelector(taskElement, taskId, currentTagId) {
    const tagSelector = taskElement.querySelector('.tag-selector');
    const tagDisplay = taskElement.querySelector('.tag-display.editable');
    const dropdown = taskElement.querySelector('.tag-dropdown');
    
    if (!tagSelector || !tagDisplay || !dropdown) {
        console.error('Tag elements not found');
        return;
    }
    
    // Remove any existing event listeners (prevent duplicates)
    const newTagDisplay = tagDisplay.cloneNode(true);
    tagDisplay.parentNode.replaceChild(newTagDisplay, tagDisplay);
    
    const newDropdown = newTagDisplay.querySelector('.tag-dropdown');
    
    // Toggle dropdown on click
    newTagDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close other dropdowns first
        document.querySelectorAll('.tag-dropdown.show').forEach(d => {
            if (d !== newDropdown) d.classList.remove('show');
        });
        
        newDropdown.classList.toggle('show');
    });
    
    // Handle tag option selection
    const tagOptions = newDropdown.querySelectorAll('.tag-option');
    tagOptions.forEach(option => {
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            const selectedColor = e.target.closest('.tag-option').dataset.color;
            
            // Immediately hide dropdown and show visual feedback
            newDropdown.classList.remove('show');
            option.style.opacity = '0.5';
            
            try {
                await updateTaskTag(taskId, selectedColor);
            } catch (error) {
                console.error('Error updating tag:', error);
            } finally {
                option.style.opacity = '';
            }
        });
    });
    
    // Set up global click listener only once
    if (!globalClickListenerAttached) {
        globalClickListenerAttached = true;
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.tag-selector') && !e.target.closest('.tag-filter')) {
                document.querySelectorAll('.tag-dropdown.show').forEach(d => {
                    d.classList.remove('show');
                });
            }
        });
    }
}

async function updateTaskTag(taskId, color) {
    // Prevent multiple simultaneous calls
    if (updateTaskTag.isUpdating) {
        console.log('Update already in progress, skipping...');
        return;
    }
    
    updateTaskTag.isUpdating = true;
    
    try {
        console.log('Updating task', taskId, 'with color', color);
        
        // Validate inputs
        if (!taskId || !color || !currentUser) {
            throw new Error('Missing required data for tag update');
        }
        
        // Ensure user tags are loaded
        if (!window.userTags) {
            await loadUserTags();
        }
        
        // Find the tag ID for this color and validate ownership
        const userTag = window.userTags?.find(tag => 
            tag.color === color && tag.user_id === currentUser.id
        );
        
        if (!userTag) {
            throw new Error('Tag not found or does not belong to user');
        }
        
        // Validate task ownership
        const task = window.allTasks?.find(t => t.id.toString() === taskId.toString());
        if (!task || task.user_id !== currentUser.id) {
            throw new Error('Task not found or access denied');
        }
        
        console.log('Found tag:', userTag);
        
        const { data, error } = await supabase
            .from('tasks_v3')
            .update({ tag_id: userTag.id })
            .eq('id', taskId)
            .eq('user_id', currentUser.id)
            .select();

        if (error) {
            console.error('Supabase error:', error);
            throw new Error(`Database error: ${error.message}`);
        }
        
        if (!data || data.length === 0) {
            throw new Error('No task was updated');
        }
        
        console.log('Task updated successfully:', data);

        // Update local data immediately
        const localTask = window.allTasks?.find(t => t.id.toString() === taskId.toString());
        if (localTask) {
            localTask.tag_id = userTag.id;
            localTask.tags_v3 = userTag;
        }
        
        // Reload tasks
        await loadTasks();
        
    } catch (error) {
        console.error('Error updating task tag:', error);
        
        let errorMessage = 'Failed to update tag.';
        if (error.message.includes('not found')) {
            errorMessage = 'Tag or task not found.';
        } else if (error.message.includes('access denied')) {
            errorMessage = 'You do not have permission to update this task.';
        }
        
        alert(errorMessage + ' Please try refreshing the page.');
        
    } finally {
        updateTaskTag.isUpdating = false;
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
                .from('tasks_v3')
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
    const taskInput = document.getElementById('taskInput');
    const taskText = taskInput.value.trim();

    if (!taskText) {
        alert('Please enter a task!');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('tasks_v3')
            .insert([{
                user_id: currentUser.id,
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
            .from('tasks_v3')
            .update({ is_done: isDone })
            .eq('id', taskId);

        if (error) throw error;

        if (isDone) {
            // Increment task completion count
            await supabase
                .from('users_v3')
                .update({ 
                    tasks_completed: currentUser.tasks_completed + 1,
                    week_count_task: currentUser.week_count_task + 1,
                    day_count_task: currentUser.day_count_task + 1
                })
                .eq('id', currentUser.id);
            
            currentUser.tasks_completed++;
            currentUser.week_count_task++;
            currentUser.day_count_task++;
            showAffirmation();
        }

        loadTasks();
        loadLeaderboards();
    } catch (error) {
        console.error('Error updating task:', error);
    }
}

async function removeTask(taskElement) {
    const taskId = taskElement.dataset.taskId;

    try {
        const { error } = await supabase
            .from('tasks_v3')
            .delete()
            .eq('id', taskId);

        if (error) throw error;

        loadTasks();
    } catch (error) {
        console.error('Error removing task:', error);
    }
}
