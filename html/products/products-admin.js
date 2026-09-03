  function toggleOosReason(val) {
    const group = document.getElementById('out-of-stock-reason-group');
    group.style.display = parseInt(val) === 0 ? 'block' : 'none';
    if (parseInt(val) !== 0) document.getElementById('pf-oos-reason').value = '';
  }

  // ── Product Image Upload ───────────────────────────────────────────────────
  function handleProductImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image too large — max 2 MB', 'error'); input.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        // Resize to max 600px on longest side
        const MAX = 600;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        document.getElementById('pf-image-data').value = dataUrl;
        document.getElementById('pf-img-thumb').src = dataUrl;
        document.getElementById('pf-img-thumb').style.display = 'block';
        document.getElementById('pf-img-emoji-ph').style.display = 'none';
        document.getElementById('pf-img-remove').style.display = 'inline-block';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleProductImageUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) { clearProductImage(); return; }
    // Basic URL check
    if (!/^https?:\/\/.+/.test(trimmed)) return;
    document.getElementById('pf-image-data').value = trimmed;
    document.getElementById('pf-image-file').value = '';
    const thumb = document.getElementById('pf-img-thumb');
    thumb.src = trimmed;
    thumb.style.display = 'block';
    document.getElementById('pf-img-emoji-ph').style.display = 'none';
    document.getElementById('pf-img-remove').style.display = 'inline-block';
    thumb.onerror = function() {
      showToast('Could not load image from that URL — check the link is a direct image URL', 'warning');
      clearProductImage();
    };
  }

  function clearProductImage() {
    document.getElementById('pf-image-data').value = '';
    document.getElementById('pf-image-file').value = '';
    document.getElementById('pf-image-url').value = '';
    document.getElementById('pf-img-thumb').src = '';
    document.getElementById('pf-img-thumb').style.display = 'none';
    document.getElementById('pf-img-emoji-ph').style.display = 'block';
    document.getElementById('pf-img-remove').style.display = 'none';
  }

  function loadProductImageIntoForm(imageData) {
    if (imageData) {
      document.getElementById('pf-image-data').value = imageData;
      document.getElementById('pf-img-thumb').src = imageData;
      document.getElementById('pf-img-thumb').style.display = 'block';
      document.getElementById('pf-img-emoji-ph').style.display = 'none';
      document.getElementById('pf-img-remove').style.display = 'inline-block';
      // If it's a URL (not base64), populate the URL field for visibility
      if (imageData.startsWith('http')) {
        document.getElementById('pf-image-url').value = imageData;
      }
    } else {
      clearProductImage();
    }
  }
