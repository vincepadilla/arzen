export function formatDate(isoString) {
  const options = { year: 'numeric', month: 'short', day: '2-digit' };
  return new Date(isoString).toLocaleDateString('en-US', options);
}

export function truncateHtmlText(htmlContent, maxLength = 150) {
  // Strip HTML tags for preview
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  let text = tempDiv.textContent || tempDiv.innerText || '';
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }
  return text;
}

export function renderBlogCards(blogs, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = ''; // Clear existing content

  blogs.forEach(blog => {
    // For Phase 2 mock, we just assume author is Arzen Navor.
    // In Phase 3, you'd fetch author profiles based on author_id.
    const authorName = "Arzen Navor"; 
    const dateStr = formatDate(blog.created_at);
    const preview = truncateHtmlText(blog.content);

    const cardHtml = `
      <div class="blog-card reveal visible" data-blog-id="${blog.id}">
        <div class="blog-body">
          <p class="blog-meta"><span class="blog-author">${authorName}</span> &bull; <span class="blog-date">${dateStr}</span></p>
          <h3 class="blog-title">${blog.title}</h3>
          <p class="blog-preview">
            ${preview}
          </p>
          <span class="read-more">Read More &#9654;</span>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
  });
}

export function setupBlogModal(blogsData) {
  const blogModal = document.getElementById('blogModal');
  const blogModalClose = document.getElementById('blogModalClose');
  const blogModalTitle = document.getElementById('blogModalTitle');
  const blogModalMeta = document.getElementById('blogModalMeta');
  const blogModalBody = document.getElementById('blogModalBody');

  if (!blogModal) return;

  function openBlogModal(blogId) {
    const blog = blogsData.find(b => b.id == blogId);
    if (!blog) return;
    
    blogModalTitle.textContent = blog.title;
    const authorName = "Arzen Navor";
    const dateStr = formatDate(blog.created_at);
    
    blogModalMeta.innerHTML = `<span class="blog-author">${authorName}</span> &bull; <span class="blog-date">${dateStr}</span>`;
    blogModalBody.innerHTML = blog.content;
    
    blogModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeBlogModal() {
    blogModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Attach event listener to document for event delegation
  // Since blog cards are dynamically added, event delegation is safer.
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.blog-card');
    if (card) {
      const blogId = card.getAttribute('data-blog-id');
      if (blogId) openBlogModal(blogId);
    }
  });

  if (blogModalClose) blogModalClose.addEventListener('click', closeBlogModal);

  blogModal.addEventListener('click', (e) => {
    if (e.target === blogModal) closeBlogModal();
  });
}
