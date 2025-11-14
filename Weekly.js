async function loadWeeks() {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
                *, 
                profiles(username)
            `)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Only completed tasks
        const doneTasks = tasks.filter(t => t.is_done);
        window.doneTasks = doneTasks; // Store for filtering

        displayByWeek();
    } catch (error) {
        console.error('Error loading completed tasks:', error);
    }
}

async function displayByWeek() {
    const tasksList = document.getElementById('weekly-posts');
    tasksList.innerHTML = '';
    let tasks = window.doneTasks
    let weeks = {}

    tasks.forEach(task => {
        if (task.is_done) {
            const monday = getMonday(task.completed_at);
            const week_of = `Week of ${monday.toLocaleDateString()}`;

            if (weeks[week_of]) {
                weeks[week_of].push(task);
            } else {
                weeks[week_of] = [task]
            }
        }
    });

    const canModify = currentUser.profile.admin === true;

    for (const [week, tasksPerWeek] of Object.entries(weeks)) {
        const weekSummary = document.createElement('div');
        weekSummary.classList.add('week-summary');
        weekSummary.dataset.week = week;

        const title = document.createElement('h2');
        title.textContent = week;
        weekSummary.appendChild(title);

        const list = document.createElement("ul");
        list.classList.add("weekly-task-list");

        for (const task of tasksPerWeek) { 
            const li = document.createElement('li');

            li.dataset.taskId = task.id;

            li.innerHTML = `
            ${canModify ? `<button class="done" onclick="markUndone(this.parentNode)">↑</button>` : ''}
            ${canModify ? `<button class="remove" onclick="removeTask(this.parentNode)">✕</button>` : ''}
            ${canModify ? createTagSelector(task.tag_id) : `<div class="tag-display" style="background-color: ${tagInfo.color}">${tagInfo.name}</div>`}
            <span class="task-content">${task.task_text}</span>
            `;

            list.appendChild(li);
        }

        weekSummary.appendChild(list);
        tasksList.appendChild(weekSummary)
    }
    
}   

async function markUndone(taskElement) {
    const taskId = taskElement.dataset.taskId;
    const isDone = !taskElement.dataset.is_done;

    console.log(taskElement)

    try {
        const { error } = await supabase
            .from('tasks')
            .update([{ 
                is_done: false,
                completed_at: null 
            }])
            .eq('id', taskId);
        if (error) throw error;

        if (!isDone) {
            // Increment task completion count
            await supabase
                .from('profiles')
                .update({ 
                    week_count_task: currentUser.profile.week_count_task - 1,
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

function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay(); 
    const diff = (day === 0 ? -6 : 1) - day; 
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0); 
    return d;
}
