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



document.addEventListener('DOMContentLoaded', function() {
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const sizeSwatches = document.querySelectorAll('.size-swatch');
  
  // COLOR SWATCH FUNCTIONALITY
  colorSwatches.forEach(function(swatch) {
    swatch.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove selected class from all color swatches
      colorSwatches.forEach(function(s) {
        s.classList.remove('color-swatch--selected');
        s.classList.remove('light-color');
      });
      
      // Add selected class to clicked swatch
      this.classList.add('color-swatch--selected');
      
      // Check if color is light to adjust checkmark color
      const bgColor = this.getAttribute('data-color');
      if (isLightColor(bgColor)) {
        this.classList.add('light-color');
      }
      
      // Get variant data
      const variantId = this.getAttribute('data-variant-id');
      const image = this.getAttribute('data-image');
      const color = this.getAttribute('data-color');
      
      // Handle your selection logic here
      console.log('Selected color variant:', { variantId, image, color });
      
      // Example: Update product image if needed
      if (image) {
        updateProductImage(image);
      }
    });
  });
  
  // SIZE SWATCH FUNCTIONALITY
  sizeSwatches.forEach(function(swatch) {
    swatch.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove selected class from all size swatches
      sizeSwatches.forEach(function(s) {
        s.classList.remove('size-swatch--selected');
      });
      
      // Add selected class to clicked swatch
      this.classList.add('size-swatch--selected');
      
      // Get variant data
      const variantId = this.getAttribute('data-variant-id');
      const size = this.getAttribute('data-size');
      

    
    });
  });
});