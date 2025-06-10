let lastScrollPosition = window.pageYOffset;
const navbar = document.querySelector('.btm-main');
const threshold = 10; // Minimum scroll difference to trigger

window.addEventListener('scroll', function() {
    const currentScrollPosition = window.pageYOffset;
    
    // Scrolling DOWN - show navbar
    if (navbar && currentScrollPosition > lastScrollPosition && currentScrollPosition > threshold) {
        navbar.classList.add('show-nav');
    } 
    // Scrolling UP - hide navbar
    else if (navbar && currentScrollPosition < lastScrollPosition) {
        navbar.classList.remove('show-nav');
    }
    
    lastScrollPosition = currentScrollPosition;
});

 // Get elements
const searchBtn = document.getElementById('searchBtn');
const searchBar = document.getElementById('searchBar');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const closeSearch = document.getElementById('closeSearch');
const body = document.body;

// Open search bar
function openSearchBar() {
    if (searchBar) searchBar.classList.add('active');
    if (searchBtn) searchBtn.classList.add('active');
    if (body) body.classList.add('search-active');
    
    // Focus on input after animation
    if (searchInput) {
        setTimeout(() => {
            searchInput.focus();
        }, 400);
    }
}

// Close search bar
function closeSearchBar() {
    if (searchBar) searchBar.classList.remove('active');
    if (searchBtn) searchBtn.classList.remove('active');
    if (body) body.classList.remove('search-active');
    if (searchInput) searchInput.value = '';
}

// Event listeners
if (searchBtn && searchBar) {
    searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (searchBar.classList.contains('active')) {
            closeSearchBar();
        } else {
            openSearchBar();
        }
    });
}

if (closeSearch) {
    closeSearch.addEventListener('click', closeSearchBar);
}

// Search functionality
function performSearch() {
    if (!searchInput) return;
    const query = searchInput.value.trim();
    if (query) {
        console.log('Searching for:', query);
        // Here you would implement your search logic
        alert(`Searching for: "${query}"`);
        closeSearchBar();
    }
}

if (searchButton) {
    searchButton.addEventListener('click', performSearch);
}

// Search on Enter key
if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

// Close search on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchBar && searchBar.classList.contains('active')) {
        closeSearchBar();
    }
});

// Add hover effects to navbar items
const stickyLinks = document.querySelectorAll('.sticky-link1:not(#searchBtn)');
if (stickyLinks && stickyLinks.length > 0) {
    stickyLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            link.classList.add('active');
        });
        
        link.addEventListener('mouseleave', () => {
            link.classList.remove('active');
        });
    });
}
