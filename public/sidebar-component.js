// Unified Sidebar Component for NEXUS
// This script provides consistent sidebar functionality across all pages

// Use global variables if they exist, otherwise create them
if (typeof window.currentWorkspaceId === 'undefined') {
    window.currentWorkspaceId = null;
}
if (typeof window.allWorkspaces === 'undefined') {
    window.allWorkspaces = [];
}

// Use the global variables
let currentWorkspaceId = window.currentWorkspaceId;
let allWorkspaces = window.allWorkspaces;

// Initialize sidebar
async function initializeSidebar(activePage) {
    await loadWorkspaceData();
    setupSidebarToggle();
    setupWorkspaceSelector();
    setupProfileDropdown();
    setupDeliveryWidget();
    setActivePage(activePage);
    setupThemeToggle();
}

// Load workspace data from API
async function loadWorkspaceData() {
    try {
        const response = await fetch('/api/workspaces');
        const data = await response.json();
        allWorkspaces = data.workspaces;

        // Get workspace ID from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const paramWorkspaceId = urlParams.get('workspace');

        if (paramWorkspaceId && allWorkspaces.some(w => w.workspace_id == paramWorkspaceId)) {
            currentWorkspaceId = parseInt(paramWorkspaceId);
        } else if (allWorkspaces.length > 0) {
            currentWorkspaceId = allWorkspaces[0].workspace_id;
        }

        updateWorkspaceUI();
        renderWorkspaceDropdown();
    } catch (error) {
        console.error('Failed to load workspaces:', error);
    }
}

// Update workspace UI
function updateWorkspaceUI() {
    const workspace = allWorkspaces.find(w => w.workspace_id === currentWorkspaceId);
    if (workspace) {
        const icon = workspace.workspace_name.charAt(0).toUpperCase();
        document.querySelector('.workspace-icon').textContent = icon;
        document.querySelector('.workspace-name').textContent = workspace.workspace_name;
    }
}

// Render workspace dropdown
function renderWorkspaceDropdown() {
    const workspaceList = document.getElementById('workspaceList');
    if (!workspaceList) return;

    const filter = document.getElementById('workspaceSearch')?.value.toLowerCase() || '';
    const filtered = allWorkspaces.filter(w => 
        w.workspace_name.toLowerCase().includes(filter)
    );

    workspaceList.innerHTML = filtered.map(w => {
        const icon = w.workspace_name.charAt(0).toUpperCase();
        const isActive = w.workspace_id === currentWorkspaceId;
        return `
            <div class="workspace-item ${isActive ? 'active' : ''}" data-workspace-id="${w.workspace_id}">
                <div class="item-icon">${icon}</div>
                <div style="flex: 1;">
                    <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-main);">${w.workspace_name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${w.workspace_slug || 'workspace'}.nexus.com</div>
                </div>
                ${isActive ? '<i data-feather="check" style="width: 16px; color: var(--primary);"></i>' : ''}
            </div>
        `;
    }).join('');

    feather.replace();

    // Add click handlers
    document.querySelectorAll('.workspace-item').forEach(item => {
        item.addEventListener('click', function() {
            const workspaceId = parseInt(this.dataset.workspaceId);
            switchWorkspace(workspaceId);
        });
    });
}

// Switch workspace
function switchWorkspace(workspaceId) {
    currentWorkspaceId = workspaceId;
    const currentPage = window.location.pathname;
    window.location.href = `${currentPage}?workspace=${workspaceId}`;
}

// Setup workspace selector
function setupWorkspaceSelector() {
    const workspaceSelector = document.getElementById('workspaceSelector');
    const workspaceDropdown = document.getElementById('workspaceDropdown');
    const selectorChevron = workspaceSelector?.querySelector('.selector-chevron');
    const workspaceSearch = document.getElementById('workspaceSearch');

    if (!workspaceSelector || !workspaceDropdown) return;

    workspaceSelector.addEventListener('click', (e) => {
        e.stopPropagation();
        workspaceDropdown.classList.toggle('show');
        if (selectorChevron) {
            selectorChevron.style.transform = workspaceDropdown.classList.contains('show') 
                ? 'rotate(180deg)' : 'rotate(0deg)';
        }
        if (workspaceDropdown.classList.contains('show') && workspaceSearch) {
            workspaceSearch.focus();
        }
    });

    if (workspaceSearch) {
        workspaceSearch.addEventListener('input', () => renderWorkspaceDropdown());
        workspaceSearch.addEventListener('click', (e) => e.stopPropagation());
    }

    document.addEventListener('click', (e) => {
        if (!workspaceSelector.contains(e.target) && !workspaceDropdown.contains(e.target)) {
            workspaceDropdown.classList.remove('show');
            if (selectorChevron) {
                selectorChevron.style.transform = 'rotate(0deg)';
            }
        }
    });
}

// Setup sidebar toggle
function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    if (!sidebar || !sidebarToggle) return;

    // Check local storage
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        sidebarToggle.innerHTML = '<i data-feather="chevron-right" style="width: 14px; height: 14px;"></i>';
        feather.replace();
    }

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const collapsed = sidebar.classList.contains('collapsed');

        localStorage.setItem('sidebarCollapsed', collapsed);

        if (collapsed) {
            sidebarToggle.innerHTML = '<i data-feather="chevron-right" style="width: 14px; height: 14px;"></i>';
        } else {
            sidebarToggle.innerHTML = '<i data-feather="chevron-left" style="width: 14px; height: 14px;"></i>';
        }
        feather.replace();
    });
}

// Setup profile dropdown
function setupProfileDropdown() {
    const userProfile = document.getElementById('userProfile');
    const profileDropdown = document.getElementById('profileDropdown');
    const profileChevron = userProfile?.querySelector('.profile-chevron');

    if (!userProfile || !profileDropdown) return;

    userProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = profileDropdown.classList.contains('show');

        if (isExpanded) {
            profileDropdown.classList.remove('show');
            if (profileChevron) profileChevron.style.transform = 'rotate(0deg)';
        } else {
            profileDropdown.classList.add('show');
            if (profileChevron) profileChevron.style.transform = 'rotate(-90deg)';
        }
    });

    document.addEventListener('click', (e) => {
        if (!userProfile.contains(e.target)) {
            profileDropdown.classList.remove('show');
            if (profileChevron) profileChevron.style.transform = 'rotate(0deg)';
        }
    });
}

// Setup delivery widget
function setupDeliveryWidget() {
    const deliveryStats = {
        '24h': { 'in-delivery': 12, 'delivered': 8, 'returned': 0 },
        '7d': { 'in-delivery': 67, 'delivered': 30, 'returned': 2 },
        '30d': { 'in-delivery': 245, 'delivered': 180, 'returned': 15 }
    };

    const timeTrigger = document.getElementById('timeTrigger');
    const timeDropdown = document.getElementById('timeDropdown');
    const currentTime = document.getElementById('currentTime');
    const timeOptions = document.querySelectorAll('.time-option');
    const statValues = document.querySelectorAll('.stat-value-sm');
    const triggerIcon = timeTrigger?.querySelector('i');

    if (!timeTrigger || !timeDropdown) return;

    // Toggle Dropdown
    timeTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        timeDropdown.classList.toggle('show');
        if (triggerIcon) {
            triggerIcon.style.transform = timeDropdown.classList.contains('show') 
                ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    });

    // Handle Option Click
    timeOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();

            // Update active state
            timeOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');

            // Update Trigger Text
            const period = option.dataset.period;
            if (currentTime) currentTime.textContent = period;

            // Update stats with animation
            const data = deliveryStats[period];
            statValues.forEach(stat => {
                const key = stat.dataset.stat;
                const target = data[key];
                animateValue(stat, parseInt(stat.textContent), target, 500);
            });

            // Close Dropdown
            timeDropdown.classList.remove('show');
            if (triggerIcon) triggerIcon.style.transform = 'rotate(0deg)';
        });
    });

    // Close on Outside Click
    document.addEventListener('click', (e) => {
        if (!timeTrigger.contains(e.target) && !timeDropdown.contains(e.target)) {
            timeDropdown.classList.remove('show');
            if (triggerIcon) triggerIcon.style.transform = 'rotate(0deg)';
        }
    });
}

// Animate value
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Set active page
function setActivePage(pageName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });
}

// Setup theme toggle
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    if (!themeToggle) return;

    // Check local storage for theme
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i data-feather="moon"></i>';
        feather.replace();
    }

    themeToggle.addEventListener('click', () => {
        body.classList.add('transitioning');
        body.classList.toggle('dark-mode');

        const darkMode = body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', darkMode);

        if (darkMode) {
            themeToggle.innerHTML = '<i data-feather="moon" style="width: 20px; height: 20px;"></i>';
        } else {
            themeToggle.innerHTML = '<i data-feather="sun" style="width: 20px; height: 20px;"></i>';
        }

        feather.replace();

        setTimeout(() => {
            body.classList.remove('transitioning');
        }, 300);
    });
}

// Setup navigation links
function setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            let url = '/';
            
            switch(page) {
                case 'dashboard':
                    url = '/dashboard.html';
                    break;
                case 'orders':
                    url = '/orders.html';
                    break;
                case 'settings':
                    url = '/settings.html';
                    break;
                default:
                    url = '/';
            }
            
            window.location.href = `${url}?workspace=${currentWorkspaceId}`;
        });
    });
}

// Export for global use
window.initializeSidebar = initializeSidebar;
window.setupNavigation = setupNavigation;
window.currentWorkspaceId = () => currentWorkspaceId;

