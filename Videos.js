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

        const viewable_vids = videos.filter(vid => !vid.hide);
        window.videos = viewable_vids``;

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

        const title = document.createElement('href');
        title.textContent = video.title;
        title.link = video.link;
        videoContainer.appendChild(title);

        const description = document.createElement('span');
        description.textContent = video.description;
        videoContainer.appendChild(description);

        const hideOption = document.createElement('div')
        hideOption.innerHTML = `${canModify ? `<button class="hide" onclick="hideVideo(this.parentNode)">✕</button>` : ''}`
        videoContainer.append(hideOption);

    });

}   

async function addVideo() {
    const videolink = document.getElementById('video-link');
    const vidLink = videolink.value.trim();

    if (!vidLink) {
        alert('Please enter a link!');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('videos')
            .insert([{
                user_id: currentUser.user.id,
                title: '',
                description: '',
                link: vidLink,
                hide: false
            }])
            .select();
        if (error) throw error;

        taskInput.value = '';
        loadTasks();
    } catch (error) {
        console.error('Error adding video:', error);
        alert('Failed to add video. Please try again.');
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
