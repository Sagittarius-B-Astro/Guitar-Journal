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
        window.videos = viewable_vids;

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
        videoContainer.classList.add('video-container')
        videoContainer.dataset.vidId = video.id;

        const hideOption = document.createElement('div')
        hideOption.innerHTML = `${canModify ? `<button class="hide" onclick="hideVideo(this.closest('.video-container'))">✕</button>` : ''}`
        videoContainer.append(hideOption);

        const title = document.createElement("h3");
        title.textContent = video.title || "Untitled Video";
        if (canModify) {
            title.contentEditable = true;
            title.addEventListener("blur", () => updateVideoField(video.id, "title", title.textContent));
        }
        videoContainer.appendChild(title);

        const iframe = document.createElement("iframe");
        iframe.src = convertToEmbedLink(video.link);
        iframe.allowFullscreen = true;
        iframe.classList.add("video-frame");
        videoContainer.appendChild(iframe);

        const desc = document.createElement("p");
        desc.textContent = video.description || "No description yet.";
        if (canModify) {
            desc.contentEditable = true;
            desc.addEventListener("blur", () => updateVideoField(video.id, "description", desc.textContent));
        }
        videoContainer.appendChild(desc);

        videoCatalogue.appendChild(videoContainer);

    });
}   

function convertToEmbedLink(link) {
  if (!link) return "";
  try {
    const url = new URL(link);

    // Handle standard YouTube links
    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    // Handle short youtu.be links
    if (url.hostname.includes("youtu.be")) {
      const videoId = url.pathname.split("/").filter(Boolean).pop();
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    // Handle already-embedded links or fallbacks
    if (url.pathname.includes("/embed/")) {
      return link;
    }

    console.warn("Unrecognized YouTube link format:", link);
    return "";
  } catch (e) {
    console.error("Error parsing YouTube link:", e, link);
    return "";
  }
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

        videolink.value = '';
        loadVideos();
    } catch (error) {
        console.error('Error adding video:', error);
        alert('Failed to add video. Please try again.');
    }
}

async function hideVideo (vidElement) {
    console.log(vidElement)
    const vidId = vidElement.dataset.vidId;

    try {
        const { error } = await supabase
            .from('videos')
            .update([{ 
                hide: true
            }])
            .eq('id', vidId);
        if (error) throw error;
        loadVideos();
    } catch (error) {
        console.error('Error hiding video:', error);
    }
}

async function updateVideoField(videoId, field, value) {
    try {
        const { error } = await supabase
        .from("videos")
        .update({ [field]: value })
        .eq("id", videoId);
        if (error) throw error;
    } catch (error) {
        console.error(`Error updating ${field}:`, error);
    }
}
