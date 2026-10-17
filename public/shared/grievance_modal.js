/**
 * Shared Grievance & Refund Policy Modal Engine
 * Handles user submissions for:
 * 1. Irrelevant games / Refund request with photo proof
 * 2. Technical issues / Bug reports with screenshots
 * 3. Feature suggestions and new assessment ideas
 */
(function() {
  function createModalDOM() {
    if (document.getElementById('cognitive-grievance-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'cognitive-grievance-modal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 hidden';
    modal.style.cssText = 'position: fixed; inset: 0; z-index: 99999; display: none; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); padding: 16px; font-family: inherit;';

    modal.innerHTML = `
      <div style="background: rgba(11, 19, 41, 0.96); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 20px; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.8); max-width: 580px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 28px; position: relative; color: #f1f5f9;">
        <!-- Close Button -->
        <button type="button" id="close-grievance-modal-btn" style="position: absolute; top: 18px; right: 18px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
          ✕
        </button>

        <!-- Header -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #06b6d4, #3b82f6); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; box-shadow: 0 8px 16px -4px rgba(6, 182, 212, 0.4);">
            🛡️
          </div>
          <div>
            <h3 style="font-size: 18px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.02em;">Refund Policy &amp; Grievance Desk</h3>
            <p style="font-size: 12px; color: #94a3b8; margin: 3px 0 0 0;">Assessment Evaluation &amp; User Experience Support</p>
          </div>
        </div>

        <!-- Policy Note Banner -->
        <div style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 12px; padding: 12px 14px; margin-bottom: 20px;">
          <p style="font-size: 11.5px; color: #e2e8f0; line-height: 1.5; margin: 0;">
            <strong>⚖️ Fair Refund Commitment:</strong> If you believe the cognitive assessments available are irrelevant or of no use for your recruitment syllabus and your money was wasted, write your issue below with photo proof (curriculum pattern, test syllabus, or assessment format). You may also report any technical errors or share suggestions.
          </p>
        </div>

        <!-- Form -->
        <form id="grievance-submission-form" style="display: flex; flex-direction: column; gap: 14px;">
          <!-- Category Selector -->
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
              Grievance Category *
            </label>
            <select id="grv-category" required style="width: 100%; padding: 10px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #f8fafc; font-size: 12.5px; outline: none; transition: border-color 0.2s;">
              <option value="refund_irrelevant">💸 Irrelevant Games / Money Wasted (Refund Request)</option>
              <option value="bug_issue">🐛 Web App Issue / Technical Glitch</option>
              <option value="suggestion">💡 Feature Suggestion / New Game Request</option>
            </select>
            <p id="grv-category-hint" style="font-size: 10.5px; color: #38bdf8; margin: 5px 0 0 2px;">
              Please attach photo proof of your curriculum/syllabus showing why the games are irrelevant.
            </p>
          </div>

          <!-- Email Input -->
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
              Your Email Address *
            </label>
            <input type="email" id="grv-email" required placeholder="your.name@college.edu or personal email" 
              style="width: 100%; box-sizing: border-box; padding: 10px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #f8fafc; font-size: 12.5px; outline: none;" />
          </div>

          <!-- Subject Input -->
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
              Subject / Brief Summary *
            </label>
            <input type="text" id="grv-subject" required placeholder="e.g. Assessment games do not match syllabus / Exam pattern mismatch" 
              style="width: 100%; box-sizing: border-box; padding: 10px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #f8fafc; font-size: 12.5px; outline: none;" />
          </div>

          <!-- Description -->
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
              Detailed Explanation *
            </label>
            <textarea id="grv-description" required rows="3" placeholder="Explain your issue in detail. For refund claims, specify which games felt irrelevant and how your syllabus differs..."
              style="width: 100%; box-sizing: border-box; padding: 10px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #f8fafc; font-size: 12.5px; outline: none; resize: vertical;"></textarea>
          </div>

          <!-- Photo Proof Upload -->
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
              Photo Proof / Screenshot (JPG, PNG, WebP)
            </label>
            <div id="grv-dropzone" style="border: 2px dashed rgba(56, 189, 248, 0.3); background: rgba(15, 23, 42, 0.6); border-radius: 12px; padding: 16px; text-align: center; cursor: pointer; transition: all 0.2s;">
              <input type="file" id="grv-photo-input" accept="image/*" style="display: none;" />
              <div id="grv-upload-placeholder">
                <span style="font-size: 24px;">📸</span>
                <p style="font-size: 12px; color: #cbd5e1; margin: 4px 0 2px; font-weight: 600;">Click to upload or drag photo proof here</p>
                <p style="font-size: 10.5px; color: #64748b; margin: 0;">Supports PNG, JPG, or Screenshots (Max 5MB)</p>
              </div>
              <div id="grv-upload-preview" style="display: none; align-items: center; gap: 12px; text-align: left;">
                <img id="grv-preview-img" src="" alt="Proof Preview" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #0284c7;" />
                <div style="flex: 1; min-width: 0;">
                  <p id="grv-preview-name" style="font-size: 12px; font-weight: 600; color: #38bdf8; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></p>
                  <p style="font-size: 10.5px; color: #94a3b8; margin: 2px 0 0 0;">Photo proof attached and ready</p>
                </div>
                <button type="button" id="grv-remove-photo" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Remove</button>
              </div>
            </div>
          </div>

          <!-- Status Message -->
          <div id="grv-status-msg" style="display: none; padding: 10px 14px; border-radius: 10px; font-size: 12px; line-height: 1.4;"></div>

          <!-- Submit Button -->
          <button type="submit" id="grv-submit-btn" style="margin-top: 6px; width: 100%; padding: 12px 18px; background: linear-gradient(135deg, #06b6d4, #2563eb); border: none; border-radius: 12px; color: #ffffff; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 8px 20px -4px rgba(6, 182, 212, 0.35); transition: opacity 0.2s;">
            <span>Submit Grievance with Proof</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Event Listeners
    const closeBtn = document.getElementById('close-grievance-modal-btn');
    closeBtn.addEventListener('click', closeGrievanceModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeGrievanceModal();
    });

    const categorySelect = document.getElementById('grv-category');
    const categoryHint = document.getElementById('grv-category-hint');
    categorySelect.addEventListener('change', () => {
      if (categorySelect.value === 'refund_irrelevant') {
        categoryHint.textContent = 'Please attach photo proof of your curriculum/syllabus showing why the games are irrelevant.';
        categoryHint.style.color = '#38bdf8';
      } else if (categorySelect.value === 'bug_issue') {
        categoryHint.textContent = 'Please attach a screenshot of the glitch or error you experienced in the app.';
        categoryHint.style.color = '#f59e0b';
      } else {
        categoryHint.textContent = 'You can optionally attach sketches or screenshots for your suggestion.';
        categoryHint.style.color = '#10b981';
      }
    });

    // File Upload / Drag & Drop
    const dropzone = document.getElementById('grv-dropzone');
    const fileInput = document.getElementById('grv-photo-input');
    const placeholder = document.getElementById('grv-upload-placeholder');
    const previewBox = document.getElementById('grv-upload-preview');
    const previewImg = document.getElementById('grv-preview-img');
    const previewName = document.getElementById('grv-preview-name');
    const removeBtn = document.getElementById('grv-remove-photo');
    let selectedBase64 = '';

    dropzone.addEventListener('click', (e) => {
      if (e.target !== removeBtn) fileInput.click();
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#38bdf8';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'rgba(56, 189, 248, 0.3)';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'rgba(56, 189, 248, 0.3)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        handleFile(fileInput.files[0]);
      }
    });

    function handleFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('Please choose an image file (PNG, JPG, WebP).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be under 5MB in size.');
        return;
      }
      previewName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        selectedBase64 = e.target.result;
        previewImg.src = selectedBase64;
        placeholder.style.display = 'none';
        previewBox.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    }

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedBase64 = '';
      fileInput.value = '';
      previewImg.src = '';
      previewBox.style.display = 'none';
      placeholder.style.display = 'block';
    });

    // Form Submit
    const form = document.getElementById('grievance-submission-form');
    const submitBtn = document.getElementById('grv-submit-btn');
    const statusMsg = document.getElementById('grv-status-msg');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.6';
      submitBtn.innerHTML = '<span>Uploading Proof &amp; Submitting...</span>';
      statusMsg.style.display = 'none';

      const email = document.getElementById('grv-email').value.trim();
      const category = document.getElementById('grv-category').value;
      const subject = document.getElementById('grv-subject').value.trim();
      const description = document.getElementById('grv-description').value.trim();

      try {
        const res = await fetch('/api/grievance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            category,
            subject,
            description,
            photoBase64: selectedBase64,
          }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          statusMsg.style.display = 'block';
          statusMsg.style.background = 'rgba(16, 185, 129, 0.15)';
          statusMsg.style.border = '1px solid rgba(16, 185, 129, 0.35)';
          statusMsg.style.color = '#34d399';
          statusMsg.innerHTML = `
            <strong>✅ Submission Received!</strong><br />
            Your request has been logged. Our review committee and Debasish Dash will audit your proof within 24-48 hours and send a response to <strong>${email}</strong>.
          `;
          form.reset();
          removeBtn.click();
          submitBtn.innerHTML = '<span>Submitted Successfully</span>';
          setTimeout(() => {
            closeGrievanceModal();
            statusMsg.style.display = 'none';
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.innerHTML = '<span>Submit Grievance with Proof</span>';
          }, 3500);
        } else {
          throw new Error(data.error || 'Submission failed');
        }
      } catch (err) {
        statusMsg.style.display = 'block';
        statusMsg.style.background = 'rgba(239, 68, 68, 0.15)';
        statusMsg.style.border = '1px solid rgba(239, 68, 68, 0.35)';
        statusMsg.style.color = '#f87171';
        statusMsg.textContent = err.message || 'Unable to submit grievance. Please try again.';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.innerHTML = '<span>Retry Submission</span>';
      }
    });
  }

  function openGrievanceModal(prefillCategory = 'refund_irrelevant', prefillEmail = '') {
    createModalDOM();
    const modal = document.getElementById('cognitive-grievance-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.setProperty('display', 'flex', 'important');
      const catSelect = document.getElementById('grv-category');
      if (catSelect && prefillCategory) catSelect.value = prefillCategory;
      const emailInput = document.getElementById('grv-email');
      if (emailInput && prefillEmail) emailInput.value = prefillEmail;
    }
  }

  function closeGrievanceModal() {
    const modal = document.getElementById('cognitive-grievance-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.setProperty('display', 'none', 'important');
    }
  }

  // Expose to window
  window.openGrievanceModal = openGrievanceModal;
  window.closeGrievanceModal = closeGrievanceModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createModalDOM);
  } else {
    createModalDOM();
  }
})();
