class WishlistManager {
    constructor() {
      this.wishlistItems = [];
      this.initialize();
    }
  
    async initialize() {
      await this.loadWishlist();
      this.setupEventListeners();
    }
  
    async loadWishlist() {
      const isLoggedIn = document.body.dataset.user !== undefined;
      if (!isLoggedIn) return;
  
      try {
        const response = await fetch('/wishlist', {
          headers: {
            'Accept': 'application/json'
          }
        });
  
        if (!response.ok) {
          throw new Error('Failed to load wishlist');
        }
  
        const data = await response.json();
        this.wishlistItems = data.items || [];
        this.updateWishlistIcons();
      } catch (error) {
        console.error('Error loading wishlist:', error);
        this.showToast(error.message || 'Error loading wishlist', 'error');
      }
    }
  
    updateWishlistIcons() {
      document.querySelectorAll('.btn-wishlist').forEach(btn => {
        const productId = btn.dataset.productId;
        const isInWishlist = this.wishlistItems.some(item => item.product._id === productId);
        
        btn.classList.toggle('active', isInWishlist);
        btn.title = isInWishlist ? 'Remove from wishlist' : 'Add to wishlist';
      });
    }
  
    async toggleWishlist(productId, element) {
      const isLoggedIn = document.body.dataset.user !== undefined;
      if (!isLoggedIn) {
        this.showToast('Please login to manage your wishlist', 'error');
        return;
      }
  
      try {
        const isActive = element.classList.contains('active');
        
        if (isActive) {
          await this.removeFromWishlist(productId, element);
        } else {
          await this.addToWishlist(productId, element);
        }
      } catch (error) {
        console.error('Error toggling wishlist:', error);
        this.showToast('Failed to update wishlist', 'error');
      }
    }
  
    async addToWishlist(productId, element) {
      const productElement = element.closest('[data-product-id]');
      const hasColor = productElement.dataset.hasColor === 'true';
      const hasSize = productElement.dataset.hasSize === 'true';
      
      let selectedColor = null;
      let selectedSize = null;
      
      if (hasColor) {
        selectedColor = this.getSelectedVariant(productId, 'color');
        if (!selectedColor) {
          this.showToast('Please select a color first', 'error');
          return;
        }
      }
      
      if (hasSize) {
        selectedSize = this.getSelectedVariant(productId, 'size');
        if (!selectedSize) {
          this.showToast('Please select a size first', 'error');
          return;
        }
      }
      
      const response = await fetch('/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          productId,
          selectedColor,
          selectedSize
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to wishlist');
      }
  
      const data = await response.json();
      this.wishlistItems.push(data.wishlist);
      element.classList.add('active');
      element.title = 'Remove from wishlist';
      this.showToast('Added to wishlist', 'success');
    }
  
    async removeFromWishlist(productId, element) {
      const wishlistItem = this.wishlistItems.find(item => item.product._id === productId);
      if (!wishlistItem) return;
  
      const response = await fetch(`/wishlist/${wishlistItem._id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove from wishlist');
      }
  
      this.wishlistItems = this.wishlistItems.filter(item => item.product._id !== productId);
      element.classList.remove('active');
      element.title = 'Add to wishlist';
      this.showToast('Removed from wishlist', 'success');
    }
  
    getSelectedVariant(productId, type) {
      const productEl = document.querySelector(`[data-product-id="${productId}"]`);
      if (!productEl) return null;
  
      const activeVariant = productEl.querySelector(`.${type}-option.active`);
      return activeVariant ? activeVariant.dataset[type] : null;
    }
  
    showToast(message, type = "success") {
      if (window._toastifyActive) return;
      window._toastifyActive = true;
      
      Toastify({
        text: message,
        duration: 2500,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: type === "success"
          ? "linear-gradient(90deg, #00b09b, #96c93d)"
          : "linear-gradient(90deg, #e74c3c, #c0392b)",
        stopOnFocus: true,
        callback: () => {
          window._toastifyActive = false;
        }
      }).showToast();
      
      setTimeout(() => {
        window._toastifyActive = false;
      }, 2600);
    }
  
    setupEventListeners() {
      document.querySelectorAll('.btn-wishlist').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const productId = btn.dataset.productId;
          this.toggleWishlist(productId, btn);
        });
      });
    }
  }
  
  // Initialize when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    window.wishlistManager = new WishlistManager();
  });