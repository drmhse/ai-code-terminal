// Documentation JavaScript - Extracted from template
document.addEventListener('DOMContentLoaded', function() {
    // Mobile navigation toggle
    const mobileToggle = document.getElementById('docs-mobile-toggle');
    const sidebar = document.getElementById('docs-sidebar');
    const overlay = document.getElementById('docs-mobile-overlay');
    
    function toggleMobileNav() {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
        mobileToggle.classList.toggle('active');
        document.body.classList.toggle('mobile-nav-open');
    }
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', toggleMobileNav);
    }
    
    if (overlay) {
        overlay.addEventListener('click', toggleMobileNav);
    }
    
    // Close mobile nav on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('mobile-open')) {
            toggleMobileNav();
        }
    });
    
    // Section toggle functionality
    const sectionToggles = document.querySelectorAll('.docs-nav-toggle');
    sectionToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const section = this.dataset.section;
            const list = document.querySelector(`[data-section="${section}"].docs-nav-list`);
            const chevron = this.querySelector('.nav-chevron');
            
            if (list && chevron) {
                list.classList.toggle('expanded');
                chevron.classList.toggle('rotated');
                this.classList.toggle('expanded');
            }
        });
    });
    
    // Auto-expand active section
    const activeLink = document.querySelector('.docs-nav-link.active');
    if (activeLink) {
        const parentList = activeLink.closest('.docs-nav-list');
        const parentToggle = document.querySelector(`[data-section="${parentList?.dataset.section}"]`);
        
        if (parentList && parentToggle) {
            parentList.classList.add('expanded');
            parentToggle.classList.add('expanded');
            const chevron = parentToggle.querySelector('.nav-chevron');
            if (chevron) chevron.classList.add('rotated');
        }
    }
    
    // Search functionality
    const searchInput = document.getElementById('docs-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase().trim();
            const navLinks = document.querySelectorAll('.docs-nav-link');
            const navSections = document.querySelectorAll('.docs-nav-section');
            
            if (query === '') {
                // Reset visibility
                navLinks.forEach(link => {
                    link.style.display = '';
                    link.closest('.docs-nav-item').style.display = '';
                });
                navSections.forEach(section => {
                    section.style.display = '';
                });
                return;
            }
            
            // Hide all first
            navSections.forEach(section => {
                section.style.display = 'none';
            });
            
            // Show matching items
            navLinks.forEach(link => {
                const text = link.textContent.toLowerCase();
                const item = link.closest('.docs-nav-item');
                const section = link.closest('.docs-nav-section');
                
                if (text.includes(query)) {
                    item.style.display = '';
                    section.style.display = '';
                    // Expand the section
                    const list = section.querySelector('.docs-nav-list');
                    const toggle = section.querySelector('.docs-nav-toggle');
                    const chevron = toggle?.querySelector('.nav-chevron');
                    
                    if (list) list.classList.add('expanded');
                    if (toggle) toggle.classList.add('expanded');
                    if (chevron) chevron.classList.add('rotated');
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
    
    // Smooth scrolling for TOC links
    document.querySelectorAll('.toc-nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = 120;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Highlight current section in TOC on scroll
    function updateTOC() {
        const headings = document.querySelectorAll('.docs-content-body h1, .docs-content-body h2, .docs-content-body h3, .docs-content-body h4, .docs-content-body h5, .docs-content-body h6');
        const tocLinks = document.querySelectorAll('.toc-nav a');
        
        let current = '';
        const fromTop = window.scrollY + 150;
        
        headings.forEach(heading => {
            if (heading.offsetTop <= fromTop) {
                current = heading.id;
            }
        });
        
        tocLinks.forEach(link => {
            link.classList.remove('active');
            if (current && link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    }
    
    // Throttle scroll events
    let ticking = false;
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateTOC);
            ticking = true;
            setTimeout(() => ticking = false, 10);
        }
    }
    
    window.addEventListener('scroll', requestTick);
    updateTOC(); // Initial call
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
            }
        }
    });
});