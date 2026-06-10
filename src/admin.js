import { authService } from './services/authService.js';
import { blogService } from './services/blogService.js';

document.addEventListener('DOMContentLoaded', async () => {
  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const adminTableBody = document.getElementById('adminTableBody');
  const logoutBtn = document.getElementById('logoutBtn');
  
  // Login DOM
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  
  // Modal DOM
  const adminModal = document.getElementById('adminModal');
  const adminModalClose = document.getElementById('adminModalClose');
  const createNewBtn = document.getElementById('createNewBtn');
  const saveBlogBtn = document.getElementById('saveBlogBtn');
  
  // Form fields
  const blogIdInput = document.getElementById('blogId');
  const blogTitleInput = document.getElementById('blogTitle');
  const blogContentInput = document.getElementById('blogContent');
  const blogPublishedInput = document.getElementById('blogPublished');
  const adminModalTitle = document.getElementById('adminModalTitle');
  const toastContainer = document.getElementById('toastContainer');

  function showToast(msg, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = type === 'success' ? '✓' : '⚠️';
    toast.innerHTML = `<strong>${icon}</strong> <span>${msg}</span>`;
    
    toastContainer.appendChild(toast);
    
    // Trigger reflow to start animation
    void toast.offsetWidth;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400); // Wait for transition
    }, 3000);
  }

  // Check auth status
  let user = await authService.getCurrentUser();
  
  if (user) {
    showDashboard();
  } else {
    showLogin();
  }

  function showLogin() {
    loginSection.style.display = 'block';
    dashboardSection.style.display = 'none';
  }

  async function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    await loadBlogs();
  }

  // --- Auth Actions ---
  if (loginSubmitBtn) {
    loginSubmitBtn.addEventListener('click', async () => {
      const email = loginEmail.value;
      const pass = loginPassword.value;
      const { data, error } = await authService.login(email, pass);
      if (data && data.user) {
        user = data.user;
        showDashboard();
        showToast("Logged in successfully!");
      } else {
        showToast("Login failed: " + error, "error");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await authService.logout();
      user = null;
      showLogin();
    });
  }

  // --- Dashboard Actions ---
  async function loadBlogs() {
    const { data: blogs, error } = await blogService.getAllBlogs();
    if (error) return console.error(error);
    
    adminTableBody.innerHTML = '';
    blogs.forEach(blog => {
      const tr = document.createElement('tr');
      
      const date = new Date(blog.created_at).toLocaleDateString();
      const status = blog.published ? '<span style="color:#3a8a3a;">Published</span>' : '<span style="color:var(--mist);">Draft</span>';
      
      tr.innerHTML = `
        <td>${blog.id}</td>
        <td><strong>${blog.title}</strong></td>
        <td>${status}</td>
        <td>${date}</td>
        <td>
          <button class="action-btn edit-btn" data-id="${blog.id}">✎ Edit</button>
          <button class="action-btn delete delete-btn" data-id="${blog.id}">🗑 Delete</button>
        </td>
      `;
      adminTableBody.appendChild(tr);
    });

    // Attach events to dynamic buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => openModal(e.target.dataset.id));
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => deleteBlog(e.target.dataset.id));
    });
  }

  // --- Modal Logic ---
  function openModal(id = null) {
    if (id) {
      adminModalTitle.textContent = 'Edit Blog';
      blogService.getBlogById(id).then(({ data: blog }) => {
        if (blog) {
          blogIdInput.value = blog.id;
          blogTitleInput.value = blog.title;
          blogContentInput.value = blog.content;
          blogPublishedInput.checked = blog.published;
          adminModal.classList.add('active');
        }
      });
    } else {
      adminModalTitle.textContent = 'Create New Blog';
      blogIdInput.value = '';
      blogTitleInput.value = '';
      blogContentInput.value = '';
      blogPublishedInput.checked = false;
      adminModal.classList.add('active');
    }
  }

  function closeModal() {
    adminModal.classList.remove('active');
  }

  if (createNewBtn) createNewBtn.addEventListener('click', () => openModal());
  if (adminModalClose) adminModalClose.addEventListener('click', closeModal);

  if (saveBlogBtn) {
    saveBlogBtn.addEventListener('click', async () => {
      const id = blogIdInput.value;
      const blogData = {
        title: blogTitleInput.value,
        content: blogContentInput.value,
        published: blogPublishedInput.checked,
        author_id: user.id
      };

      if (id) {
        const { error } = await blogService.updateBlog(id, blogData);
        if (error) {
          showToast("Error updating blog: " + error, "error");
        } else {
          showToast("Blog updated successfully!");
        }
      } else {
        const { error } = await blogService.createBlog(blogData);
        if (error) {
          showToast("Error creating blog: " + error, "error");
        } else {
          showToast("Blog created successfully!");
        }
      }
      
      closeModal();
      await loadBlogs();
    });
  }

  async function deleteBlog(id) {
    if (confirm('Are you sure you want to delete this blog?')) {
      const { error } = await blogService.deleteBlog(id);
      if (error) {
        showToast("Error deleting blog: " + error, "error");
      } else {
        showToast("Blog deleted successfully!");
      }
      await loadBlogs();
    }
  }
});
