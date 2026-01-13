// Modal utility for alerts and confirms
// Replaces window.alert() and window.confirm() with styled modals

// Initialize modal on page load
document.addEventListener('DOMContentLoaded', () => {
  initModal();
});

function initModal() {
  // Create modal HTML if not exists
  if (document.getElementById('customModal')) return;

  const modalHTML = `
    <div id="customModal" class="custom-modal">
      <div class="modal-overlay"></div>
      <div class="modal-container">
        <div class="modal-content">
          <div class="modal-icon" id="modalIcon"></div>
          <h3 class="modal-title" id="modalTitle"></h3>
          <p class="modal-message" id="modalMessage"></p>
          <div class="modal-buttons" id="modalButtons"></div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Add modal styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    .custom-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 100000;
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .custom-modal.active {
      display: flex;
      align-items: center;
      justify-content: center;
      animation: modalFadeIn 0.3s ease-out;
    }

    .modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.75);
      animation: overlayFadeIn 0.3s ease-out;
    }

    .modal-container {
      position: relative;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 520px;
      width: auto;
      max-height: 90vh;
      overflow-y: auto;
      animation: modalSlideIn 0.3s ease-out;
      border: 1px solid #e5e7eb;
    }

    .modal-container::-webkit-scrollbar {
      width: 8px;
    }

    .modal-container::-webkit-scrollbar-track {
      background: #f8f9fa;
    }

    .modal-container::-webkit-scrollbar-thumb {
      background: #dadce0;
      border-radius: 4px;
    }

    .modal-container::-webkit-scrollbar-thumb:hover {
      background: #bdc1c6;
    }

    .modal-content {
      padding: 24px;
      text-align: center;
    }

    .modal-icon {
      font-size: 32px;
      margin-bottom: 12px;
      line-height: 1;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
    }

    .modal-message {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
      margin-bottom: 20px;
      white-space: pre-wrap;
      text-align: left;
    }

    .modal-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .modal-btn {
      padding: 10px 24px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease-out;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      font-family: 'Space Grotesk', sans-serif;
      min-width: 100px;
    }

    .modal-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .modal-btn:active {
      transform: translateY(0);
    }

    .modal-btn-primary {
      background: #2563eb;
      color: white;
      border-color: #2563eb;
    }

    .modal-btn-primary:hover {
      background: #1d4ed8;
      border-color: #1d4ed8;
    }

    .modal-btn-success {
      background: #10b981;
      color: white;
      border-color: #10b981;
    }

    .modal-btn-success:hover {
      background: #059669;
      border-color: #059669;
    }

    .modal-btn-danger {
      background: #ef4444;
      color: white;
      border-color: #ef4444;
    }

    .modal-btn-danger:hover {
      background: #dc2626;
      border-color: #dc2626;
    }

    .modal-btn-secondary {
      background: #f3f4f6;
      color: #374151;
      border-color: #e5e7eb;
    }

    .modal-btn-secondary:hover {
      background: #e5e7eb;
    }

    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes overlayFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes modalSlideIn {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes modalSlideOut {
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(-20px);
        opacity: 0;
      }
    }
  `;

  document.head.appendChild(styleSheet);
}

// Show alert modal
function showModal(message, options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customModal');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const buttons = document.getElementById('modalButtons');

    // Set content
    icon.textContent = options.icon || 'ℹ️';
    title.textContent = options.title || 'Message';
    messageEl.textContent = message;

    // Create button
    buttons.innerHTML = '';
    const okBtn = document.createElement('button');
    okBtn.className = 'modal-btn modal-btn-primary';
    okBtn.textContent = options.okText || 'OK';
    okBtn.onclick = () => {
      closeModal();
      resolve(true);
    };
    buttons.appendChild(okBtn);

    // Show modal
    modal.classList.add('active');

    // Close on overlay click
    const overlay = modal.querySelector('.modal-overlay');
    overlay.onclick = () => {
      closeModal();
      resolve(true);
    };

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        resolve(true);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus button
    setTimeout(() => okBtn.focus(), 100);
  });
}

// Show confirm modal
function showConfirm(message, options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customModal');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const buttons = document.getElementById('modalButtons');

    // Set content
    icon.textContent = options.icon || '❓';
    title.textContent = options.title || 'Confirm';
    // Use innerHTML if message contains HTML tags, otherwise use textContent
    if (message.includes('<')) {
      messageEl.innerHTML = message;
    } else {
      messageEl.textContent = message;
    }

    // Create buttons
    buttons.innerHTML = '';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn modal-btn-secondary';
    cancelBtn.textContent = options.cancelText || 'Cancel';
    cancelBtn.onclick = () => {
      closeModal();
      resolve(false);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.className = `modal-btn ${options.danger ? 'modal-btn-danger' : 'modal-btn-primary'}`;
    confirmBtn.textContent = options.confirmText || 'Confirm';
    confirmBtn.onclick = () => {
      closeModal();
      resolve(true);
    };

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);

    // Show modal
    modal.classList.add('active');

    // Close on overlay click
    const overlay = modal.querySelector('.modal-overlay');
    overlay.onclick = () => {
      closeModal();
      resolve(false);
    };

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        resolve(false);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus confirm button
    setTimeout(() => confirmBtn.focus(), 100);
  });
}

// Show prompt modal (with input)
function showPrompt(message, defaultValue = '', options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customModal');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const buttons = document.getElementById('modalButtons');

    // Set content
    icon.textContent = options.icon || '✏️';
    title.textContent = options.title || 'Input Required';

    // Create input
    const inputHTML = `
      <div style="text-align: left; margin-bottom: 8px;">${message}</div>
      <input type="text" id="modalInput" value="${defaultValue}"
             style="width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px;
                    font-size: 14px; font-family: 'Space Grotesk', sans-serif; margin-bottom: 8px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    `;
    messageEl.innerHTML = inputHTML;

    // Create buttons
    buttons.innerHTML = '';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn modal-btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
      closeModal();
      resolve(null);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'modal-btn modal-btn-primary';
    confirmBtn.textContent = 'OK';
    confirmBtn.onclick = () => {
      const input = document.getElementById('modalInput');
      closeModal();
      resolve(input.value);
    };

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);

    // Show modal
    modal.classList.add('active');

    // Focus input
    setTimeout(() => {
      const input = document.getElementById('modalInput');
      input.focus();
      input.select();

      // Submit on Enter
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          closeModal();
          resolve(input.value);
        }
      });
    }, 100);

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        resolve(null);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

// Close modal
function closeModal() {
  const modal = document.getElementById('customModal');
  const container = modal.querySelector('.modal-container');

  container.style.animation = 'modalSlideOut 0.2s ease-out';

  setTimeout(() => {
    modal.classList.remove('active');
    container.style.animation = '';
  }, 200);
}

// Export functions
window.showModal = showModal;
window.showConfirm = showConfirm;
window.showPrompt = showPrompt;
