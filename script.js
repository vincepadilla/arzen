/* Scroll reveal */
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

/* Show profile fallback immediately if src is placeholder */
window.addEventListener('DOMContentLoaded', () => {
  const img = document.getElementById('profile-photo');
  if (img && img.getAttribute('src') === 'your-photo.jpg') {
    img.style.display = 'none';
    document.getElementById('photo-fallback').style.display = 'flex';
  }
});

/* Contact form feedback */
function handleSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = '✓ Message Sent!';
  btn.style.background = '#3a8a3a';
  setTimeout(() => { btn.textContent = '▶ Send Message'; btn.style.background = ''; e.target.reset(); }, 3000);
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
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function updateModalContent() {
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

/* Preload Images for Fast Cache Loading */
window.addEventListener('load', () => {
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
});

/* Blogs Data & Logic */
const blogsData = {
  "blog1": {
    title: "The Future of Sustainable Concrete",
    author: "Arzen Navor",
    date: "Oct 15, 2025",
    content: "<p>The construction industry is constantly evolving, and one of the most critical areas of research is finding sustainable alternatives to traditional concrete.</p><p>As structural engineers, we are responsible for specifying materials that not only meet the required strength and durability parameters but also minimize environmental impact. We've seen significant progress in geopolymer concrete and the use of supplementary cementitious materials (SCMs) like fly ash, slag, and silica fume.</p><p>Moving forward, the integration of carbon-capture technologies within the concrete mixing process holds incredible promise for creating carbon-negative structural elements.</p>"
  },
  "blog2": {
    title: "Understanding Seismic Dampers",
    author: "Arzen Navor",
    date: "Sep 02, 2025",
    content: "<p>Seismic events pose a massive threat to civil structures, especially in earthquake-prone regions like the Pacific Ring of Fire. While traditional ductile design allows the building to absorb energy through controlled damage (yielding), modern approaches use seismic dampers to dissipate energy without damaging the main structural components.</p><p>Viscous dampers, which act essentially like shock absorbers for buildings, have proven extremely effective in reducing floor accelerations and inter-story drifts. When modeling these in software like ETABS, nonlinear time history analysis is crucial to accurately capture their velocity-dependent behavior.</p>"
  },
  "blog3": {
    title: "BIM Coordination Challenges",
    author: "Arzen Navor",
    date: "Aug 18, 2025",
    content: "<p>Building Information Modeling (BIM) has revolutionized how we design and construct, but it comes with its own set of coordination challenges. One of the most common issues arises when integrating the structural model with Mechanical, Electrical, and Plumbing (MEP) models.</p><p>Clash detection in Navisworks often reveals pipes running straight through deep steel beams or concrete shear walls. The key to resolving these is early coordination meetings. By defining 'keep-out' zones and establishing clear rules for web penetrations in steel beams early in the schematic design phase, we can save countless hours of rework and prevent costly delays on site.</p>"
  },
  "blog4": {
    title: "Advances in Bridge Aerodynamics",
    author: "Arzen Navor",
    date: "Jul 10, 2025",
    content: "<p>Long-span bridges, such as suspension and cable-stayed bridges, are highly susceptible to wind-induced vibrations. Understanding bridge aerodynamics is no longer just about testing physical models in wind tunnels; it's heavily reliant on Computational Fluid Dynamics (CFD).</p><p>By simulating turbulent wind flows around complex deck cross-sections, engineers can optimize the aerodynamic shape of the deck to mitigate flutter and vortex-induced vibrations. This combination of digital simulation and physical testing ensures these monumental structures remain stable even in extreme weather conditions.</p>"
  },
  "blog5": {
    title: "Geotechnical Site Investigation Best Practices",
    author: "Arzen Navor",
    date: "Jun 22, 2025",
    content: "<p>A superstructure is only as good as the foundation it rests upon. Yet, geotechnical site investigations are often underfunded or rushed. Comprehensive soil testing, including standard penetration tests (SPT), cone penetration tests (CPT), and lab analysis, is vital.</p><p>Skipping these steps can lead to unforeseen differential settlement, expansive soil issues, or even bearing capacity failure. Investing in a thorough geotechnical report provides the data necessary to design optimized, safe, and cost-effective foundation systems.</p>"
  }
};

const blogModal = document.getElementById('blogModal');
const blogModalClose = document.getElementById('blogModalClose');
const blogModalTitle = document.getElementById('blogModalTitle');
const blogModalMeta = document.getElementById('blogModalMeta');
const blogModalBody = document.getElementById('blogModalBody');

function openBlogModal(blogId) {
  const blog = blogsData[blogId];
  if (!blog) return;
  blogModalTitle.textContent = blog.title;
  blogModalMeta.innerHTML = `<span class="blog-author">${blog.author}</span> &bull; <span class="blog-date">${blog.date}</span>`;
  blogModalBody.innerHTML = blog.content;
  blogModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeBlogModal() {
  blogModal.classList.remove('active');
  document.body.style.overflow = '';
}

document.querySelectorAll('.blog-card').forEach(card => {
  card.addEventListener('click', () => {
    const blogId = card.getAttribute('data-blog-id');
    openBlogModal(blogId);
  });
});

if (blogModalClose) blogModalClose.addEventListener('click', closeBlogModal);

if (blogModal) {
  blogModal.addEventListener('click', (e) => {
    if (e.target === blogModal) closeBlogModal();
  });
}

/* Chatbot Logic */
document.addEventListener('DOMContentLoaded', () => {
  const chatToggleBtn = document.getElementById('chatToggleBtn');
  const chatCloseBtn = document.getElementById('chatCloseBtn');
  const chatClearBtn = document.getElementById('chatClearBtn');
  const chatWindow = document.getElementById('chatWindow');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatMessages = document.getElementById('chatMessages');

  if (!chatToggleBtn) return;

  chatToggleBtn.addEventListener('click', () => {
    chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
  });

  chatCloseBtn.addEventListener('click', () => {
    chatWindow.style.display = 'none';
  });

  if (chatClearBtn) {
    chatClearBtn.addEventListener('click', () => {
      chatMessages.innerHTML = '<div class="chat-message bot-message">Hello! I am Arzen\'s virtual assistant. Ask me anything about his civil engineering background and experience!</div>';
    });
  }

  const appendMessage = (text, sender) => {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message');
    msgDiv.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const sendMessage = async () => {
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
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

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

  chatSendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
});

