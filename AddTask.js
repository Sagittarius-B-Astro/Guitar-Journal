// Task colors in order: All, Composition / Cover, Ear Training / Theory / Tab, Website Dev
const colors = ['#016B61', '#70B2B2', '#9ECFD4', '#E5E9C5'];

// Task functions
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

async function loadUserTags() {
    if (!currentUser) return;
    
    try {
        const { data: tags, error } = await supabase
            .from('tags_v3')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Create default tags if they don't exist
        const existingColors = tags.map(tag => tag.color);
        const missingColors = colors.filter(color => !existingColors.includes(color));
        
        if (missingColors.length > 0) {
            const defaultTags = missingColors.map(color => ({
                user_id: currentUser.id,
                color: color,
                tag_name: getDefaultTagName(color)
            }));
            
            await supabase.from('tags_v3').insert(defaultTags);
            return loadUserTags(); // Reload after creating defaults
        }
        
        window.userTags = tags;
        
        // Update the tag filter bar if we're on "My Tasks"
        if (currentTaskFilter === 'my') {
            displayTagFilterBar();
        }
        
        return tags;
    } catch (error) {
        console.error('Error loading user tags:', error);
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

async function loadUserFilter() {
    try {
        const { data: users, error } = await supabase
            .from('users_v3')
            .select('username')
            .order('username');

        if (error) throw error;

        const userSelect = document.getElementById('userFilter');
        userSelect.innerHTML = '<option value="">Filter by tech...</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            userSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading user filter:', error);
    }
}

// Global variable to track current tag filter
let currentTagFilter = null;

function displayTagFilterBar() {
    // Remove existing tag filter bar
    const existingBar = document.querySelector('.tag-filter-bar');
    if (existingBar) {
        existingBar.remove();
    }
    
    if (!window.userTags || currentTaskFilter !== 'my') {
        return;
    }
    
    const tasksList = document.getElementById('tasks');
    const tagFilterBar = document.createElement('div');
    tagFilterBar.className = 'tag-filter-bar';
    
    // Add "All" filter
    const allFilter = document.createElement('div');
    allFilter.className = `tag-filter ${currentTagFilter === null ? 'active' : ''}`;
    allFilter.innerHTML = `
        <div class="tag-filter-color" style="background: linear-gradient(45deg, ${colors.join(', ')})">All</div>
    `;
    allFilter.addEventListener('click', () => {
        currentTagFilter = null;
        filterTasks();
        updateTagFilterActiveState();
    });
    tagFilterBar.appendChild(allFilter);
    
    // Add individual tag filters
    colors.forEach(color => {
        const userTag = window.userTags.find(tag => tag.color === color);
        if (!userTag) return;
        
        const tagFilter = document.createElement('div');
        tagFilter.className = `tag-filter ${currentTagFilter === userTag.id ? 'active' : ''}`;
        tagFilter.dataset.tagId = userTag.id;
        tagFilter.dataset.color = color;
        
        tagFilter.innerHTML = `
            <div class="tag-filter-color" style="background-color: ${color}">${userTag.tag_name}</div>
        `;
        
        // Single click to filter
        let filterClickTimer = null; // for single vs double click

        // Single click to filter
        tagFilter.addEventListener('click', (e) => {
        // Cancel any pending timer if this is the second click
            if (filterClickTimer) clearTimeout(filterClickTimer);

            // Delay to check if a double-click happens
            filterClickTimer = setTimeout(() => {
            currentTagFilter = userTag.id;
            filterTasks();
            updateTagFilterActiveState();
            filterClickTimer = null;
            }, 250); // adjust to match your other dblclick delay
        });

        // Double click to edit
        tagFilter.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (filterClickTimer) clearTimeout(filterClickTimer); // prevent single click firing
            editTagNameInFilter(userTag.id, tagFilter.querySelector('.tag-filter-color'));
        });

        tagFilterBar.appendChild(tagFilter);

    });
    
    // Insert before tasks list
    tasksList.parentNode.insertBefore(tagFilterBar, tasksList);
}

function updateTagFilterActiveState() {
    document.querySelectorAll('.tag-filter').forEach(filter => {
        const tagId = filter.dataset.tagId;
        if (currentTagFilter === null && !tagId) {
            filter.classList.add('active');
        } else if (currentTagFilter && tagId && parseInt(tagId) === currentTagFilter) {
            filter.classList.add('active');
        } else {
            filter.classList.remove('active');
        }
    });
}

async function editTagNameInFilter(tagId, tagElement) {
    const currentTag = window.userTags?.find(tag => tag.id === tagId);
    if (!currentTag || currentTag.user_id !== currentUser.id) {
        return;
    }
    
    // Check if there's already an input field
    const existingInput = tagElement.querySelector('.tag-name-edit-input');
    if (existingInput) {
        existingInput.focus();
        return;
    }
    
    const originalText = tagElement.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTag.tag_name;
    input.className = 'tag-name-edit-input';
    
    // Clear the element and add input
    tagElement.textContent = '';
    tagElement.appendChild(input);
    input.focus();
    input.select();
    
    const saveEdit = async () => {
        const newName = input.value.trim();
        
        if (!newName) {
            alert('Tag name cannot be empty!');
            input.focus();
            return;
        }
        
        if (newName === currentTag.tag_name) {
            cancelEdit();
            return;
        }
        
        try {
            const { error } = await supabase
                .from('tags_v3')
                .update({ tag_name: newName })
                .eq('id', tagId)
                .eq('user_id', currentUser.id);

            if (error) throw error;

            // Update local cache
            currentTag.tag_name = newName;
            tagElement.textContent = newName;
            loadTasks(); // Reload to show updated name in tasks
            
        } catch (error) {
            console.error('Error updating tag name:', error);
            alert('Failed to update tag name. Please try again.');
            cancelEdit();
        }
    };
    
    const cancelEdit = () => {
        tagElement.textContent = originalText;
    };
    
    input.addEventListener('blur', () => {
        setTimeout(saveEdit, 100);
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
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

// Initialize tags when user logs in
async function initializeTags() {
    if (currentUser) {
        console.log('Initializing tags for user:', currentUser.id);
        await loadUserTags();
        console.log('Tags loaded:', window.userTags);
    }
}

// Affirmation functions
function getRandomAffirmation() {
    const randomIndex = Math.floor(Math.random() * affirmations.length);
    return affirmations[randomIndex];
}

function showAffirmation() {
    const affirmationText = getRandomAffirmation();
    
    const affirmationElement = document.createElement('div');
    affirmationElement.classList.add('affirmation');
    affirmationElement.textContent = affirmationText;

    document.body.appendChild(affirmationElement);

    setTimeout(() => {
        affirmationElement.classList.add('fadeOut');
        setTimeout(() => {
            affirmationElement.remove();
        }, 1000);
    }, 2000);
}
