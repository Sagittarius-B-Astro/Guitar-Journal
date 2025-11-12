async function loadVideos() {
    try {
        const { data: videos, error } = await supabase
            .from('videos')
            .select(`
                *, 
                profiles(username)
            `)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Only completed tasks
        window.videos = videos; // Store for filtering

        displayVideos();
    } catch (error) {
        console.error('Error loading videos:', error);
    }
}

async function displayVideos() {
    const videoCatalogue = document.getElementById('video-catalogue');
    videoCatalogue.innerHTML = '';
    let videos = window.videos
    const canModify = currentUser.profile.admin === true;


    videos.forEach(video => {
        const videoContainer = document.createElement('div');
        videoContainer.classList.add('video')
        videoContainer.dataset.vidId = video.id;

        const title = document.createElement('h3');
        title.textContent = video.title;
        videoContainer.appendChild(title);

        const description = document.createElement('span');
        description.textContent = video.description;
        videoContainer.appendChild(description);

        const link = document.createElement('href');
        link.textContent = video.link;
        videoContainer.appendChild(link);

        const hideOption = document.createElement('div')
        hideOption.innerHTML = `${canModify ? `<button class="hide" onclick="hideVideo(this.parentNode)">✕</button>` : ''}`
        videoContainer.append(hideOption);

    });

}   

async function addVideo() {
    const taskInput = document.getElementById('task-text');
    const vidText = taskInput.value.trim();

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

async function hideVideo (vidElement) {
    const vidId = vidElement.dataset.vidId;
    const currentHide = vidElement.dataset.hide;

    try {
        const { error } = await supabase
            .from('videos')
            .update([{ 
                hide: !currentHide,
            }])
            .eq('id', vidId);
        if (error) throw error;
    } catch (error) {
        console.error('Error hiding video:', error);
    }
}
