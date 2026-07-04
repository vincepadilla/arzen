import { blogService } from './services/blogService.js';
import { renderBlogCards, setupBlogModal } from './ui/blogRenderer.js';

document.addEventListener('DOMContentLoaded', async () => {
  /* Theme Toggle Logic */
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  
  // Define icons
  const sunIcon = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
  const moonIcon = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;

  // Initialize theme from localStorage or default to dark
  if (themeToggle && themeIcon) {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light-mode');
      themeIcon.innerHTML = moonIcon;
    } else {
      themeIcon.innerHTML = sunIcon;
    }

    themeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('light-mode');
      const isLight = document.documentElement.classList.contains('light-mode');
      
      if (isLight) {
        localStorage.setItem('theme', 'light');
        themeIcon.innerHTML = moonIcon;
      } else {
        localStorage.setItem('theme', 'dark');
        themeIcon.innerHTML = sunIcon;
      }
    });
  }

  /* Scroll reveal logic */
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  /* Show profile fallback immediately if src is placeholder */
  const img = document.getElementById('profile-photo');
  if (img && img.getAttribute('src') === 'your-photo.jpg') {
    img.style.display = 'none';
    const fallback = document.getElementById('photo-fallback');
    if (fallback) fallback.style.display = 'flex';
  }

  /* Contact form feedback */
  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.textContent = '✓ Message Sent!';
      btn.style.background = '#3a8a3a';
      setTimeout(() => { btn.textContent = '▶ Send Message'; btn.style.background = ''; e.target.reset(); }, 3000);
    });
  }

  /* Projects Popup Slider Data & Logic */
  const projectsData = {
    "project1": [
      {
        image: "/Projects/project1_related/perspective.png",
        title: "Perspective View",
        description: "Modeled in Sketchup and rendered using Enscape."
      },
      {
        image: "/Projects/project1_related/structural.png",
        title: "Structural Analysis using ETABS Software",
        description: "The first version of the design was conducted using ETABS and then proceeded to design revisions and improvements using SAP2000 for optimization of the design."
      },
      {
        image: "/Projects/project1_related/column_and_shearwall.png",
        title: "Column and Shear Wall Connection Detailing",
        description: "Structural detailing and scheduling for the column and shear wall connection for the elevator shaft"
      },
      {
        image: "/Projects/project1_related/ductile_column.png",
        title: "Ductile Column Detailing",
        description: "Column seismic detailing based on NSCP 2015"
      },
      {
        image: "/Projects/project1_related/ductile_beam_detailing.png",
        title: "Ductile Beam Detailing",
        description: "Ductile detailing for beams in accordance with the NSCP 2015 provision"
      }
    ],
    "project2": [
      {
        image: "/Projects/project2_related/3Dview_workflow.png",
        title: "3D View Workflow in Autodesk Revit",
        description: "Showcasing the complete workflow using Revit 2024"
      },
      {
        image: "/Projects/project2_related/floorplanworkflow.png",
        title: "Floor Plan Workflow View in Autodesk Revit",
        description: "Floor plan workflow workaround in Revit 2024"
      },
      {
        image: "/Projects/project2_related/frontelevation.png",
        title: "Front Elevation Perspective Sample Output",
        description: "Sample output for perspective showcasing the Front Elevation of the project"
      }
    ],
    "project3": [
      {
        image: "/Projects/project3_related/structuralprovisions.png",
        title: "Structural Earthquake Provision NSCP 2015",
        description: "Earthquake parameters used in accordance with NSCP 2015 and UBC 1997"
      },
      {
        image: "/Projects/project3_related/linearstaticanalysis.png",
        title: "Linear Static Analysis using STAAD.Pro",
        description: "Modeled and analyze using STAAD.Pro for the linear static analysis."
      },
      {
        image: "/Projects/project3_related/modeshapes.png",
        title: "Different Mode Shapes",
        description: "Performed elastic modal analysis. Fundamental modes exhibit X and Y translation with expected period values, while Mode 3 shows torsional behavior indicating moderate eccentricity in mass/stiffness distribution."
      },
      {
        image: "/Projects/project3_related/capacityspectrum.png",
        title: "Capacity Spectrum Method Pushover Analysis",
        description: "Nonlinear static pushover analysis provided the global capacity curve. The model exhibits ductile post-yield behavior, confirming good redistribution capacity of the system."
      }
    ]
  };

  let currentProject = null;
  let currentSlideIndex = 0;

  const modal = document.getElementById('projectModal');
  const modalClose = document.getElementById('modalClose');
  const sliderImg = document.getElementById('sliderImg');
  const sliderPrev = document.getElementById('sliderPrev');
  const sliderNext = document.getElementById('sliderNext');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const sliderDots = document.getElementById('sliderDots');

  function openModal(projectId) {
    currentProject = projectsData[projectId];
    if (!currentProject) return;
    currentSlideIndex = 0;
    updateModalContent();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateModalContent() {
    if (!currentProject || !sliderImg) return;
    const slide = currentProject[currentSlideIndex];

    // Reset animation
    sliderImg.classList.remove('fade-anim');
    modalTitle.classList.remove('fade-anim');
    modalDesc.classList.remove('fade-anim');

    // Trigger reflow
    void sliderImg.offsetWidth;

    sliderImg.src = slide.image;
    modalTitle.textContent = slide.title;
    modalDesc.textContent = slide.description;

    // Start animation
    sliderImg.classList.add('fade-anim');
    modalTitle.classList.add('fade-anim');
    modalDesc.classList.add('fade-anim');

    if (sliderDots) {
      sliderDots.innerHTML = '';
      currentProject.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `dot ${index === currentSlideIndex ? 'active' : ''}`;
        dot.addEventListener('click', () => {
          currentSlideIndex = index;
          updateModalContent();
        });
        sliderDots.appendChild(dot);
      });
    }
  }

  function nextSlide() {
    if (!currentProject) return;
    currentSlideIndex = (currentSlideIndex + 1) % currentProject.length;
    updateModalContent();
  }

  function prevSlide() {
    if (!currentProject) return;
    currentSlideIndex = (currentSlideIndex - 1 + currentProject.length) % currentProject.length;
    updateModalContent();
  }

  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => {
      const projectId = card.getAttribute('data-id');
      openModal(projectId);
    });
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (sliderNext) sliderNext.addEventListener('click', nextSlide);
  if (sliderPrev) sliderPrev.addEventListener('click', prevSlide);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Preload project images
  const preloadedImages = [];
  for (const key in projectsData) {
    projectsData[key].forEach(slide => {
      if (slide.image) {
        const img = new Image();
        img.src = slide.image;
        preloadedImages.push(img);
      }
    });
  }

  /* Load and Render Blogs Dynamically */
  const { data: publishedBlogs, error } = await blogService.getPublishedBlogs();
  if (!error && publishedBlogs) {
    setupBlogModal(publishedBlogs);
    
    // Check which page we're on based on container ID or URL
    const isHomePage = document.getElementById('hero') && document.querySelector('.hero-name');
    
    // If it's the home page, only show latest 3 blogs. If blogs.html, show all.
    const containerId = 'blogsGrid';
    if (document.getElementById(containerId)) {
      const blogsToRender = window.location.pathname.includes('blogs') ? publishedBlogs : publishedBlogs.slice(0, 3);
      renderBlogCards(blogsToRender, containerId);
    }
  }

  /* Chatbot Logic */
  const chatToggleBtn = document.getElementById('chatToggleBtn');
  const chatCloseBtn = document.getElementById('chatCloseBtn');
  const chatClearBtn = document.getElementById('chatClearBtn');
  const chatWindow = document.getElementById('chatWindow');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatMessages = document.getElementById('chatMessages');

  if (chatToggleBtn) {
    chatToggleBtn.addEventListener('click', () => {
      chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
    });
  }

  if (chatCloseBtn) {
    chatCloseBtn.addEventListener('click', () => {
      chatWindow.style.display = 'none';
    });
  }

  if (chatClearBtn && chatMessages) {
    chatClearBtn.addEventListener('click', () => {
      chatMessages.innerHTML = '<div class="chat-message bot-message">Hello! I am Arzen\'s virtual assistant. Ask me anything about his civil engineering background and experience!</div>';
    });
  }

  const appendMessage = (text, sender) => {
    if (!chatMessages) return;
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message');
    msgDiv.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const sendMessage = async () => {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    chatInput.value = '';
    
    // Typing indicator
    const typingId = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('chat-message', 'bot-message');
    typingDiv.id = typingId;
    typingDiv.textContent = 'Typing...';
    if (chatMessages) {
      chatMessages.appendChild(typingDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      
      const data = await response.json();
      
      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();

      if (response.ok) {
        appendMessage(data.reply, 'bot');
      } else {
        appendMessage("Error: " + (data.error || "Could not get response."), 'bot');
      }
    } catch (error) {
      console.error(error);
      const typingEl = document.getElementById(typingId);
      if (typingEl) typingEl.remove();
      appendMessage("Error: Could not connect to the server.", 'bot');
    }
  };

  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', sendMessage);
  }
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }

});
