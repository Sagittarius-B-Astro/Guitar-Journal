async function loadWeeks() {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
                *, 
                profiles(username),
                is_Done === true                
            `)
            .order('created_at', { ascending: true });

        if (error) throw error;

        window.doneTasks = tasks; // Store for filtering
        displayByWeek();
    } catch (error) {
        console.error('Error loading completed tasks:', error);
    }
}

async function displayByWeek() {
    let tasks = window.doneTasks

    try {
        const { data: weeks, error } = await supabase
            .from('weekly')
            .select(`
                *, 
                profiles(username),
            `)
            .order('week_of', { ascending: true });

        if (error) throw error;

        tasks.forEach(task => {
            if (task.is_done) {
                if (task.completed_at && task.completed_at ) {

                } else {
                    const weekSummary = document.createElement('weekSummary');
                    weekSummary.dataset.user_id = currentUser.profile.id;

                    const canModify = currentUser.profile.admin === true;

                    weekSummary.innerHTML = `
                    ${canModify ? `<button class="done" onclick="markUndone(this.parentNode)">↑</button>` : ''}
                    ${canModify ? `<button class="remove" onclick="removeTask(this.parentNode)">✕</button>` : ''}
                    <span class="task-content">Week of ${week.week_of}</span>
                    `;
                }
            }
        });
    } catch (error) {
        console.error('Error loading weekly completed tasks:', error);
    }
}   

async function markUndone(taskElement) {
    const taskId = taskElement.dataset.taskId;
    const isDone = !taskElement.classList.contains('finished');

    try {
        const { error } = await supabase
            .from('tasks')
            .update([{ 
                is_done: isDone,
                completed_at: null 
            }])
            .eq('id', taskId);
        if (error) throw error;

        if (isDone) {
            // Increment task completion count
            await supabase
                .from('profiles')
                .update({ 
                    week_count_task: currentUser.profile.week_count_task + 1,
                })
                .eq('id', currentUser.user.id);
            
            currentUser.profile.week_count_task++;
        }

        loadTasks();
    } catch (error) {
        console.error('Error updating task:', error);
    }
}
